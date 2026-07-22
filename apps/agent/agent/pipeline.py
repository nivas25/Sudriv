"""
Voice Pipeline Builder

LiveKit Agents 1.6.x:
  STT  → Sarvam Saaras v3
  LLM  → OpenAI gpt-4o-mini (livekit.plugins.openai.LLM)
  TTS  → Sarvam Bulbul v3
  Tools → SudrivToolkit

Audio: RoomIO sample_rate must match STT (16 kHz mono).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

from livekit.agents import llm

from agent.llm_clients import OPENAI_MODEL, create_conversation_llm
from agent.plugins.sarvam_stt import SARVAM_STT_SAMPLE_RATE, create_sarvam_stt
from agent.plugins.sarvam_tts import create_sarvam_tts
from agent.prompts import build_system_prompt
from agent.session import SessionManager
from agent.tools import SudrivToolkit

logger = logging.getLogger("sudriv-agent.pipeline")

PIPELINE_SAMPLE_RATE = SARVAM_STT_SAMPLE_RATE


@dataclass(frozen=True)
class VoicePipeline:
    stt: Any
    llm: Any
    tts: Any
    tools: list
    instructions: str
    sample_rate: int = PIPELINE_SAMPLE_RATE
    conversation_model: str = OPENAI_MODEL


def build_voice_pipeline(session: SessionManager) -> VoicePipeline:
    """Build STT / OpenAI LLM / TTS / tools for one session."""
    sarvam_api_key = os.environ.get("SARVAM_API_KEY", "")
    if not sarvam_api_key:
        raise ValueError("SARVAM_API_KEY is required for STT/TTS. Set apps/agent/.env")

    # en-IN + codemix: English / Hindi / Hinglish without free-form auto-detect.
    stt_instance = create_sarvam_stt(
        api_key=sarvam_api_key,
        language="en-IN",
        model="saaras:v3",
        mode="codemix",
        sample_rate=PIPELINE_SAMPLE_RATE,
        high_vad_sensitivity=True,
        flush_signal=True,
    )

    llm_instance = create_conversation_llm()

    # Production voice: priya @ 24kHz / 192k (see sarvam_tts defaults).
    tts_instance = create_sarvam_tts(api_key=sarvam_api_key)

    toolkit = SudrivToolkit(session=session)
    agent_tools = llm.find_function_tools(toolkit)
    instructions = build_system_prompt(session)

    logger.info(
        "Pipeline ready: STT=saaras:v3/codemix/en-IN | LLM=openai/%s | "
        "prompt_chars=%d | TTS=bulbul:v3/priya@24k",
        OPENAI_MODEL,
        len(instructions),
    )
    logger.debug("System prompt:\n%s", instructions)

    return VoicePipeline(
        stt=stt_instance,
        llm=llm_instance,
        tts=tts_instance,
        tools=agent_tools,
        instructions=instructions,
        sample_rate=PIPELINE_SAMPLE_RATE,
        conversation_model=OPENAI_MODEL,
    )
