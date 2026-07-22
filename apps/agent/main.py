"""
Sudriv Voice Agent — Entry Point

LiveKit Agents 1.6.x worker: one AgentSession per production room.

Usage:
    uv run python main.py dev
    uv run python main.py start

See: knowledge-base/05-voice-agent-design.md
"""

from __future__ import annotations

import asyncio
import logging

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
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.voice.room_io import AudioInputOptions, RoomOptions
from livekit.agents.voice.turn import InterruptionOptions, PreemptiveGenerationOptions
from livekit.plugins import silero

from agent.pipeline import PIPELINE_SAMPLE_RATE, build_voice_pipeline
from agent.session import SessionManager

load_dotenv()

logger = logging.getLogger("sudriv-agent")


async def entrypoint(ctx: JobContext) -> None:
    """
    Job lifecycle:
      connect (audio) → wait for producer → load session →
      start AgentSession (STT/LLM/TTS on session) → greet → converse
    """
    logger.info("Agent joining room: %s", ctx.room.name)

    # AUDIO_ONLY: Room connects with auto_subscribe=False then subscribes to
    # remote audio publications (see livekit.agents.job._apply_auto_subscribe_opts).
    # Without this, RoomIO never gets mic frames and STT is deaf.
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    logger.info(
        "Producer joined identity=%s kind=%s pubs=%s",
        participant.identity,
        participant.kind,
        [
            (p.sid, p.kind, p.source, p.subscribed)
            for p in participant.track_publications.values()
        ],
    )

    session_mgr = await SessionManager.from_room(ctx.room)
    logger.info("Session initialized: %s", session_mgr.session_id)

    pipeline = build_voice_pipeline(session_mgr)

    # Canonical 1.6 pattern: models live on AgentSession; Agent holds
    # instructions + tools (+ turn-handling). Empty AgentSession() is wrong.
    # Production turn-taking: snappy endpointing + fast barge-in.
    # (LiveKit turns docs: lower min_delay + short min_duration for responsiveness)
    agent_session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=pipeline.stt,
        llm=pipeline.llm,
        tts=pipeline.tts,
        turn_handling=TurnHandlingOptions(
            endpointing=EndpointingOptions(min_delay=0.3, max_delay=2.5),
            interruption=InterruptionOptions(
                enabled=True,
                mode="vad",
                min_duration=0.25,
                min_words=0,
                resume_false_interruption=True,
                false_interruption_timeout=1.2,
            ),
            preemptive_generation=PreemptiveGenerationOptions(
                enabled=True,
                preemptive_tts=True,
            ),
        ),
    )

    agent = Agent(
        instructions=pipeline.instructions,
        tools=pipeline.tools,
    )

    @agent_session.on("user_input_transcribed")
    def _on_stt(ev) -> None:
        logger.info(
            "STT final=%s text=%r lang=%s",
            ev.is_final,
            ev.transcript,
            getattr(ev, "language", None),
        )

    @agent_session.on("conversation_item_added")
    def _on_item_added(_ev) -> None:
        try:
            asyncio.create_task(session_mgr.sync_context_to_redis(agent.chat_ctx))
        except Exception:
            logger.exception("Failed to schedule chat context sync")

    @agent_session.on("error")
    def _on_error(ev) -> None:
        # Surface STT/LLM/TTS failures that would otherwise look like "deaf agent"
        logger.error("AgentSession error: %s", ev)

    # RoomIO must deliver mono PCM at the same rate Sarvam STT expects.
    # Default RoomIO is 24 kHz → would force RecognizeStream sox resampler.
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
                "RoomIO ready — listening to %s (STT @ %d Hz)",
                linked.identity if linked else "(none)",
                PIPELINE_SAMPLE_RATE,
            )
        except Exception:
            logger.exception("RoomIO wait_for_ready failed")

    greeting = session_mgr.build_greeting()
    logger.info("Greeting: %s", greeting)
    await agent_session.say(greeting, allow_interruptions=True)


def prewarm(proc: JobProcess) -> None:
    """Load Silero VAD once per worker (KB: avoid cold start on first speech)."""
    # Tuned for PCR: short speech ok, slightly snappy end-of-turn
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.08,
        min_silence_duration=0.28,
        prefix_padding_duration=0.25,
        activation_threshold=0.45,
    )
    logger.info("Worker pre-warmed (Silero VAD)")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        ),
    )
