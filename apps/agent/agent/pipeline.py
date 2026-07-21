"""
Voice Pipeline Builder

Constructs the VoicePipelineAgent with STT, LLM, TTS, and tools.

See: knowledge-base/05-voice-agent-design.md
"""

import logging

from livekit.agents import llm
from livekit.agents.voice import VoicePipelineAgent

from agent.prompts import build_system_prompt
from agent.session import SessionManager
from agent.tools import SudrivToolkit

logger = logging.getLogger("sudriv-agent.pipeline")


async def build_voice_agent(session: SessionManager) -> VoicePipelineAgent:
    """
    Build the complete voice pipeline agent with all components.

    Components:
    - STT: Sarvam Saaras v3 (Hindi + English + Hinglish)
    - LLM: Groq Llama 3.3 70B (via OpenAI-compatible API)
    - TTS: Sarvam Bulbul v3
    - Tools: 5 core tools for running order management

    See: knowledge-base/09-language-and-voice-pipeline.md
    """

    # --- STT Configuration ---
    # TODO: Replace with Sarvam STT plugin when available
    # For now, using a placeholder. See knowledge-base/09-language-and-voice-pipeline.md
    # for custom plugin implementation.
    #
    # stt = SarvamSTT(
    #     api_key=os.environ["SARVAM_API_KEY"],
    #     model="saaras:v3",
    #     language="hi-IN",
    # )

    # --- LLM Configuration ---
    # Groq uses OpenAI-compatible API
    # TODO: Configure Groq LLM
    # from livekit.plugins.openai import LLM as OpenAILLM
    #
    # llm_instance = OpenAILLM(
    #     model="llama-3.3-70b-versatile",
    #     api_key=os.environ["GROQ_API_KEY"],
    #     base_url="https://api.groq.com/openai/v1",
    #     temperature=0.3,
    # )

    # --- TTS Configuration ---
    # TODO: Replace with Sarvam TTS plugin when available
    # tts = SarvamTTS(
    #     api_key=os.environ["SARVAM_API_KEY"],
    #     model="bulbul:v3",
    #     voice="meera",
    # )

    # --- Tools ---
    toolkit = SudrivToolkit(session=session)

    # --- Chat Context ---
    chat_ctx = llm.ChatContext()
    chat_ctx.append(
        role="system",
        text=build_system_prompt(session),
    )

    # --- Build Agent ---
    # TODO: Uncomment and configure once STT/LLM/TTS plugins are ready
    #
    # agent = VoicePipelineAgent(
    #     vad=silero.VAD.load(),
    #     stt=stt,
    #     llm=llm_instance,
    #     tts=tts,
    #     chat_ctx=chat_ctx,
    #     fnc_ctx=toolkit.to_function_context(),
    #     allow_interruptions=True,
    #     interrupt_speech_duration=0.5,
    #     interrupt_min_words=1,
    #     min_endpointing_delay=0.5,
    # )

    # Placeholder — will be replaced with actual agent
    logger.warning("Voice pipeline not fully configured — using placeholder")

    # For scaffolding, return a minimal agent
    # This will be replaced once API keys are configured
    agent = VoicePipelineAgent(
        chat_ctx=chat_ctx,
        fnc_ctx=toolkit.to_function_context(),
    )

    return agent
