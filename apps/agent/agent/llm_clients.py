"""
LLM clients for Sudriv — OpenAI only (LiveKit Agents 1.6.x).

Canonical integration (livekit-plugins-openai):

    from livekit.plugins import openai
    llm = openai.LLM(
        model="gpt-4o-mini",
        api_key=os.environ["OPENAI_API_KEY"],  # or omit to use env
        temperature=0.3,
        max_completion_tokens=220,
    )

Docs: https://docs.livekit.io/agents/models/llm/openai/
"""

from __future__ import annotations

import logging
import os

from livekit.plugins import openai as lk_openai

logger = logging.getLogger("sudriv-agent.llm_clients")

# Main voice + tool-routing model (fast, stable, good function calling).
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# Short Hindi turns — room for a warm phrase without rambling.
MAX_COMPLETION_TOKENS = int(os.environ.get("OPENAI_MAX_COMPLETION_TOKENS", "160"))


def _openai_api_key() -> str:
    return os.environ.get("OPENAI_API_KEY", "")


def create_conversation_llm() -> lk_openai.LLM:
    """
    OpenAI LLM for AgentSession (every voice turn + tool calls).

    Uses the official LiveKit OpenAI plugin (same package as Agents 1.6.6 extras).
    Default API base is https://api.openai.com/v1 — do not set base_url to Groq.
    """
    key = _openai_api_key()
    if not key:
        raise ValueError(
            "OPENAI_API_KEY is required. Set it in apps/agent/.env"
        )

    logger.info(
        "Conversation LLM: openai/%s (max_completion_tokens=%d)",
        OPENAI_MODEL,
        MAX_COMPLETION_TOKENS,
    )
    return lk_openai.LLM(
        model=OPENAI_MODEL,
        api_key=key,
        # Slightly warmer than pure-strict; still reliable for tools
        temperature=0.35,
        max_completion_tokens=MAX_COMPLETION_TOKENS,
        top_p=0.9,
    )
