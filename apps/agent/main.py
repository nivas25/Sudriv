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
from agent.session import SessionManager

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


def _is_human_participant(p) -> bool:
    """True for producer clients; false for agent workers."""
    identity = (getattr(p, "identity", None) or "").lower()
    if identity.startswith("agent") or identity.startswith("sudriv-agent"):
        return False
    kind = getattr(p, "kind", None)
    # livekit.rtc.ParticipantKind.AGENT == 4 in recent SDKs
    try:
        from livekit import rtc as _rtc

        if kind == _rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            return False
    except Exception:
        pass
    kind_s = str(kind).upper()
    if "KIND_AGENT" in kind_s or kind_s.endswith(".AGENT"):
        return False
    return True


def _remote_humans(room) -> list:
    return [p for p in room.remote_participants.values() if _is_human_participant(p)]


async def _wait_for_producer(room, *, timeout: float = 20.0):
    """
    Wait for a producer without hanging forever.

    Prefer any remote human already listed (even if not yet ACTIVE). Fall back
    to participant_connected / participant_active events. On timeout return
    None so AgentSession can start and RoomIO can link later.
    """
    existing = _remote_humans(room)
    if existing:
        preferred = next(
            (p for p in existing if (p.identity or "").startswith("producer")),
            existing[0],
        )
        logger.info(
            "Producer already in room: %s (state=%s)",
            preferred.identity,
            getattr(preferred, "state", "?"),
        )
        return preferred

    logger.info("Waiting for producer (timeout=%.0fs)…", timeout)
    loop = asyncio.get_running_loop()
    fut: asyncio.Future = loop.create_future()

    def _maybe_resolve(p) -> None:
        if fut.done() or not _is_human_participant(p):
            return
        fut.set_result(p)

    room.on("participant_connected", _maybe_resolve)
    room.on("participant_active", _maybe_resolve)
    try:
        existing = _remote_humans(room)
        if existing:
            preferred = next(
                (p for p in existing if (p.identity or "").startswith("producer")),
                existing[0],
            )
            return preferred
        return await asyncio.wait_for(fut, timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning(
            "No producer after %.0fs — starting anyway (RoomIO links later). remotes=%s",
            timeout,
            [getattr(p, "identity", "?") for p in room.remote_participants.values()],
        )
        return None
    finally:
        room.off("participant_connected", _maybe_resolve)
        room.off("participant_active", _maybe_resolve)


async def entrypoint(ctx: JobContext) -> None:
    logger.info("Joining room %s", ctx.room.name)

    async def _on_shutdown(reason: str) -> None:
        logger.warning("Job shutdown room=%s reason=%s", ctx.room.name, reason)

    ctx.add_shutdown_callback(_on_shutdown)

    logger.info("Connecting to LiveKit room…")
    try:
        await asyncio.wait_for(
            ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        logger.error("ctx.connect timed out after 30s — aborting job")
        return
    except Exception:
        logger.exception("ctx.connect failed")
        return

    remotes = [
        f"{p.identity}:{getattr(p, 'state', '?')}"
        for p in ctx.room.remote_participants.values()
    ]
    logger.info(
        "Connected to room %s remotes=%s",
        ctx.room.name,
        remotes or "[]",
    )

    # Do NOT block session start forever on wait_for_participant — that left
    # the UI on CONNECTING (agent present, no AgentSession state attrs yet)
    # while the producer was still connecting / ICE negotiating.
    # Short wait only — producer may still be negotiating ICE. Start the
    # AgentSession either way so RoomIO can attach when they appear.
    participant = await _wait_for_producer(ctx.room, timeout=8.0)
    if participant is not None:
        logger.info("Producer ready: %s", participant.identity)
    else:
        logger.warning("Starting without linked producer yet")

    session_mgr = await SessionManager.from_room(ctx.room)
    segs = len(session_mgr.running_order.get("segments", []))
    logger.info("Session %s ready (%d segments)", session_mgr.session_id, segs)

    try:
        pipeline = build_voice_pipeline(session_mgr)
    except Exception:
        logger.exception("build_voice_pipeline failed — job cannot continue")
        raise

    # Real-time barge-in:
    # - mode=vad + very low min_duration → stop TTS as soon as user speech energy
    #   is detected (do NOT wait for STT words).
    # - resume_false_interruption=False → NEVER restart the interrupted utterance.
    agent_session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=pipeline.stt,
        llm=pipeline.llm,
        tts=pipeline.tts,
        user_away_timeout=None,
        conn_options=SessionConnectOptions(max_unrecoverable_errors=100),
        turn_handling=TurnHandlingOptions(
            endpointing=EndpointingOptions(min_delay=0.35, max_delay=2.0),
            interruption=InterruptionOptions(
                enabled=True,
                mode="vad",
                min_duration=0.05,
                min_words=0,
                resume_false_interruption=False,
                false_interruption_timeout=None,
                discard_audio_if_uninterruptible=False,
            ),
            preemptive_generation=PreemptiveGenerationOptions(
                enabled=False,
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
        text = (ev.transcript or "").strip()
        if not text:
            return
        if agent_session.agent_state == "speaking":
            try:
                agent_session.interrupt()
                logger.info("Barge-in interrupt (STT while speaking): %r", text[:60])
            except Exception:
                logger.exception("interrupt() failed")
        if ev.is_final:
            logger.info("STT final: %r", text)
            try:
                asyncio.create_task(session_mgr.mark_conversation_active())
            except Exception:
                pass

    @agent_session.on("user_state_changed")
    def _on_user_state(ev) -> None:
        new_state = getattr(ev, "new_state", None) or getattr(ev, "state", None)
        if new_state == "speaking" and agent_session.agent_state == "speaking":
            try:
                agent_session.interrupt()
                logger.info("Barge-in interrupt (user speaking)")
            except Exception:
                logger.exception("interrupt() on user_state_changed failed")

    @agent_session.on("conversation_item_added")
    def _on_item_added(_ev) -> None:
        try:
            asyncio.create_task(session_mgr.sync_context_to_redis(agent.chat_ctx))
            asyncio.create_task(session_mgr.mark_conversation_active())
        except Exception:
            logger.exception("chat context sync failed")

    @agent_session.on("error")
    def _on_error(ev) -> None:
        logger.error("Session error (continuing): %s", ev)

    @agent_session.on("close")
    def _on_close(ev) -> None:
        logger.warning(
            "AgentSession closed session=%s reason=%s error=%s",
            session_mgr.session_id,
            getattr(ev, "reason", None),
            getattr(ev, "error", None),
        )

    # Link to producer when known; otherwise RoomIO auto-links first human.
    room_options_kwargs: dict = {
        "audio_input": AudioInputOptions(
            sample_rate=PIPELINE_SAMPLE_RATE,
            num_channels=1,
            frame_size_ms=50,
            auto_gain_control=True,
        ),
    }
    if participant is not None:
        room_options_kwargs["participant_identity"] = participant.identity

    await agent_session.start(
        agent=agent,
        room=ctx.room,
        room_options=RoomOptions(**room_options_kwargs),
    )

    rio = getattr(agent_session, "_room_io", None)
    if rio is not None:
        try:
            await asyncio.wait_for(rio.wait_for_ready(), timeout=15.0)
            linked = rio.linked_participant
            logger.info(
                "Listening to %s",
                linked.identity if linked else "(none yet — will link on join)",
            )
        except Exception:
            logger.warning("RoomIO not ready yet — will link when producer joins")

    if await session_mgr.should_greet():
        greeting = session_mgr.build_greeting()
        logger.info("Greeting: %s", greeting)
        try:
            await agent_session.say(greeting, allow_interruptions=True)
        except Exception:
            logger.exception("Greeting failed (session still running)")
    else:
        logger.info(
            "Skipping greeting for session %s (already active)",
            session_mgr.session_id,
        )
    await session_mgr.mark_conversation_active()
    logger.info("Session live — agent ready for conversation")

    # Late producer join: browser often connects after agent is already up.
    # Log clearly when they appear so we can confirm the link.
    def _on_producer_connected(p) -> None:
        try:
            if not _is_human_participant(p):
                return
            logger.info(
                "Producer joined late: %s — RoomIO should link automatically",
                getattr(p, "identity", "?"),
            )
        except Exception:
            logger.exception("producer_connected handler failed")

    ctx.room.on("participant_connected", _on_producer_connected)
    ctx.room.on("participant_active", _on_producer_connected)
    # If they arrived during pipeline setup, log now
    for p in _remote_humans(ctx.room):
        logger.info("Producer present after start: %s", p.identity)


def prewarm(proc: JobProcess) -> None:
    # Sensitive VAD for instant barge-in. False triggers are rare under PTT
    # (mic is off unless the producer is holding the button).
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.03,
        min_silence_duration=0.25,
        prefix_padding_duration=0.15,
        activation_threshold=0.35,
    )
    logger.info("Worker ready (VAD loaded, fast barge-in)")


if __name__ == "__main__":
    # LiveKit health HTTP server (default prod 8081). Railway sets PORT.
    health_port = int(os.environ.get("PORT") or os.environ.get("AGENT_HTTP_PORT") or "8081")

    # Production stability (Railway / single-instance deploy):
    # - num_idle_processes=1  — prod default is 4; each prewarms Silero VAD and
    #   burns RAM. One warm idle process is enough for a demo/prod MVP.
    # - initialize_process_timeout=60 — VAD load under memory pressure can exceed
    #   the 10s default and thrash process restarts.
    # - load_threshold=0.95 — prod default 0.7 rejects jobs when a single worker
    #   is moderately busy, which looks like "agent went silent".
    # agent_name must match web token/ensure-agent (SUDRIV_AGENT_NAME = "sudriv").
    # Named dispatch + restart-on-failure lets the UI re-summon this worker when
    # a job dies mid-session, instead of leaving the producer stuck on CONNECTING.
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
            job_memory_warn_mb=1500,
        ),
    )
