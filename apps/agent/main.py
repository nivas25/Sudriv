"""
Sudriv Voice Agent — Entry Point

LiveKit Agents 1.6.x worker: one AgentSession per production room.

Usage:
    uv run python main.py dev
    uv run python main.py start
"""

from __future__ import annotations

import asyncio
import logging
import os
import re

from dotenv import load_dotenv
from livekit.agents import (
    APIConnectOptions,
    AutoSubscribe,
    EndpointingOptions,
    JobContext,
    JobProcess,
    TurnHandlingOptions,
    WorkerOptions,
    cli,
)
from livekit.agents.llm import ChatContext, ChatMessage, StopResponse
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.voice.agent_session import SessionConnectOptions
from livekit.agents.voice.room_io import AudioInputOptions, RoomOptions
from livekit.agents.voice.turn import InterruptionOptions, PreemptiveGenerationOptions
from livekit.plugins import silero

from agent.pipeline import PIPELINE_SAMPLE_RATE, build_voice_pipeline
from agent.session import SessionManager, close_redis

load_dotenv()

# ── Logging: important only ──────────────────────────────────────────────
_LOG_LEVEL = os.environ.get("SUDRIV_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("sudriv-agent")

# Mute noisy third-party chatter unless explicitly debugging.
for _noisy in (
    "livekit",
    "livekit.agents",
    "livekit.plugins",
    "httpx",
    "httpcore",
    "openai",
    "asyncio",
    "websockets",
    "aiohttp",
):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

# Keep our package visible.
logging.getLogger("sudriv-agent").setLevel(getattr(logging, _LOG_LEVEL, logging.INFO))


# Discard empty / noise-like STT finals so the agent does not reply to silence.
_NOISE_RE = re.compile(
    r"^(uh+|um+|ah+|oh+|hmm+|mm+|huh+|ha+|eh+|a+|i+|the|yeah|ok|okay|\.|\,|\?|\!)+$",
    re.IGNORECASE,
)


class SudrivAgent(Agent):
    """Agent that ignores empty/garbage user turns."""

    async def on_user_turn_completed(
        self, turn_ctx: ChatContext, new_message: ChatMessage
    ) -> None:
        text = (new_message.text_content or "").strip()
        if len(text) < 2 or _NOISE_RE.match(text):
            logger.info("Ignoring empty/noise turn: %r", text)
            raise StopResponse()


def _pick_producer(room) -> object | None:
    """Prefer producer-* STANDARD remote; fall back to any non-agent remote."""
    remotes = list(room.remote_participants.values())
    if not remotes:
        return None
    producers = [
        p
        for p in remotes
        if (getattr(p, "identity", None) or "").startswith("producer")
    ]
    if producers:
        return producers[0]
    # Skip other agents if any show up as remote
    humans = [
        p
        for p in remotes
        if not (getattr(p, "identity", None) or "").lower().startswith("agent")
    ]
    return humans[0] if humans else remotes[0]


async def entrypoint(ctx: JobContext) -> None:
    logger.info("Joining room %s", ctx.room.name)

    async def _on_shutdown(reason: str) -> None:
        logger.warning("Job shutdown room=%s reason=%s", ctx.room.name, reason)
        try:
            await close_redis()
        except Exception:
            logger.exception("close_redis failed")

    ctx.add_shutdown_callback(_on_shutdown)

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(
        "Connected room=%s remotes=%s",
        ctx.room.name,
        [getattr(p, "identity", "?") for p in ctx.room.remote_participants.values()]
        or "[]",
    )

    # Producer may already be in the room (or still connecting). Do not crash the
    # job if the room drops while waiting (common on browser remount / token race).
    participant = _pick_producer(ctx.room)
    if participant is None:
        try:
            participant = await ctx.wait_for_participant()
        except RuntimeError as e:
            # livekit: "room disconnected while waiting for participant"
            logger.warning(
                "Stopped waiting for producer room=%s: %s "
                "(producer left or page remounted — job will end cleanly)",
                ctx.room.name,
                e,
            )
            return
        except Exception:
            logger.exception("wait_for_participant failed room=%s", ctx.room.name)
            return

    if participant is None:
        logger.warning("No producer in room %s — exiting job", ctx.room.name)
        return

    logger.info("Producer joined: %s", getattr(participant, "identity", participant))

    session_mgr = await SessionManager.from_room(ctx.room)
    segs = len(session_mgr.running_order.get("segments", []))
    logger.info("Session %s ready (%d segments)", session_mgr.session_id, segs)

    pipeline = build_voice_pipeline(session_mgr)

    # Sarvam STT/TTS WS can need >10s under concurrent connect (default API timeout).
    _api_conn = APIConnectOptions(max_retry=3, timeout=30.0, retry_interval=1.5)

    # Stable turn-taking (working stack):
    # - VAD barge-in with resume on false interrupt (smooth speech)
    # - min_duration 0.15: still snappy under PTT, fewer choppy self-cuts
    # - preemptive LLM on, preemptive TTS off → less audio glitching
    agent_session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=pipeline.stt,
        llm=pipeline.llm,
        tts=pipeline.tts,
        conn_options=SessionConnectOptions(
            stt_conn_options=_api_conn,
            tts_conn_options=_api_conn,
        ),
        turn_handling=TurnHandlingOptions(
            endpointing=EndpointingOptions(min_delay=0.7, max_delay=3.0),
            interruption=InterruptionOptions(
                enabled=True,
                mode="vad",
                min_duration=0.15,
                min_words=0,
                resume_false_interruption=True,
                false_interruption_timeout=1.0,
            ),
            preemptive_generation=PreemptiveGenerationOptions(
                enabled=True,
                preemptive_tts=False,
            ),
        ),
    )

    agent = SudrivAgent(
        instructions=pipeline.instructions,
        tools=pipeline.tools,
    )

    @agent_session.on("user_input_transcribed")
    def _on_stt(ev) -> None:
        if ev.is_final and (ev.transcript or "").strip():
            logger.info("STT final: %r", ev.transcript)

    @agent_session.on("conversation_item_added")
    def _on_item_added(_ev) -> None:
        try:
            asyncio.create_task(session_mgr.sync_context_to_redis(agent.chat_ctx))
        except Exception:
            logger.exception("chat context sync failed")

    @agent_session.on("error")
    def _on_error(ev) -> None:
        logger.error("Session error: %s", ev)

    room_options = RoomOptions(
        participant_identity=participant.identity,
        audio_input=AudioInputOptions(
            sample_rate=PIPELINE_SAMPLE_RATE,
            num_channels=1,
            frame_size_ms=50,
            auto_gain_control=True,
        ),
    )

    await agent_session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_options,
    )

    room_io = getattr(agent_session, "_room_io", None)
    if room_io is not None:
        try:
            await room_io.wait_for_ready()
            linked = room_io.linked_participant
            logger.info(
                "Listening to %s",
                linked.identity if linked else "(none)",
            )
        except Exception:
            logger.exception("RoomIO not ready")

    # Always greet (7f7ca21) — do not gate on Redis flags
    greeting = session_mgr.build_greeting()
    logger.info("Greeting: %s", greeting)
    try:
        await agent_session.say(greeting, allow_interruptions=True)
        logger.info("Greeting spoken session=%s", session_mgr.session_id)
    except Exception:
        logger.exception("Greeting failed session=%s", session_mgr.session_id)

    logger.info(
        "Session live room=%s session=%s producer=%s",
        ctx.room.name,
        session_mgr.session_id,
        participant.identity,
    )


def prewarm(proc: JobProcess) -> None:
    # Snappy speech-onset detection for real-time barge-in.
    # False triggers are mitigated by push-to-talk (mic off when not held).
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.05,
        min_silence_duration=0.70,
        prefix_padding_duration=0.2,
        activation_threshold=0.4,
    )
    logger.info("Worker ready (VAD loaded, fast barge-in)")


if __name__ == "__main__":
    # LiveKit health HTTP server (default prod 8081). Railway sets PORT.
    health_port = int(os.environ.get("PORT") or os.environ.get("AGENT_HTTP_PORT") or "8081")

    # CRITICAL: agent_name must match web token dispatch (SUDRIV_AGENT_NAME = "sudriv").
    # Without a name the worker only gets *automatic* jobs. Our token uses *named*
    # RoomAgentDispatch — so an unnamed worker never receives the room job
    # (no "Joining room" logs, producer hears silence).
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name=os.environ.get("SUDRIV_AGENT_NAME", "sudriv"),
            port=health_port,
            host="0.0.0.0",
            log_level=os.environ.get("SUDRIV_LOG_LEVEL", "INFO").lower(),
            num_idle_processes=1,
            initialize_process_timeout=60.0,
            load_threshold=0.95,
        ),
    )
