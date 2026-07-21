"""
Sudriv Voice Agent — Entry Point

LiveKit Agents worker that connects to rooms and runs the voice co-pilot.

Usage:
    uv run python main.py dev       # Development mode (auto-reload)
    uv run python main.py start     # Production mode

See: knowledge-base/05-voice-agent-design.md
"""

import logging

from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, JobProcess, WorkerOptions, cli

from agent.pipeline import build_voice_agent
from agent.session import SessionManager

# Load environment variables
load_dotenv()

logger = logging.getLogger("sudriv-agent")


async def entrypoint(ctx: JobContext):
    """
    Called when a new LiveKit room is created.
    One agent instance per production session.

    Flow:
    1. Connect to the room (audio only)
    2. Wait for the producer participant
    3. Initialize session state from room metadata
    4. Build and start the voice pipeline agent
    5. Deliver greeting
    """
    logger.info(f"Agent joining room: {ctx.room.name}")

    # Connect to the room — only subscribe to audio
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Wait for the producer to join
    participant = await ctx.wait_for_participant()
    logger.info(f"Producer joined: {participant.identity}")

    # Initialize session from room metadata
    session = await SessionManager.from_room(ctx.room)
    logger.info(f"Session initialized: {session.session_id}")

    # Build the voice pipeline agent
    agent = await build_voice_agent(session)

    # Start the agent
    agent.start(ctx.room, participant)

    # Deliver contextual greeting
    greeting = session.build_greeting()
    logger.info(f"Greeting: {greeting}")
    await agent.say(greeting)


def prewarm(proc: JobProcess):
    """
    Pre-warm expensive resources once per worker process.
    Called before any jobs are dispatched.
    """
    # TODO: Pre-load VAD model
    # from livekit.plugins import silero
    # proc.userdata["vad"] = silero.VAD.load()
    logger.info("Worker pre-warmed")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        ),
    )
