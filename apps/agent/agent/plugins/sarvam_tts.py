"""
Sarvam TTS — Sudriv factory for LiveKit Agents 1.6.x

Uses the official ``livekit-plugins-sarvam`` Bulbul implementation
(streaming WebSocket + HTTP fallback).

Do not re-implement ChunkedStream / SynthesizeStream by hand unless the
official plugin is missing a required feature — the 1.6 TTS contract uses
``AudioEmitter`` and differs from older ``_event_queue`` sketches in the KB.

See:
- knowledge-base/09-language-and-voice-pipeline.md
- https://docs.livekit.io/agents/models/tts/sarvam/
"""

from __future__ import annotations

import logging
import os

from livekit.plugins import sarvam

logger = logging.getLogger("sudriv-agent.plugins.sarvam_tts")


def create_sarvam_tts(
    *,
    api_key: str | None = None,
    model: str = "bulbul:v3",
    speaker: str = "ritu",
    target_language_code: str = "hi-IN",
    speech_sample_rate: int = 22050,
    pace: float = 1.1,
    min_buffer_size: int = 40,
    max_chunk_length: int = 120,
) -> sarvam.TTS:
    """
    Build a production Sarvam TTS instance for Sudriv.

    Latency knobs (safe defaults for PCR voice):
    - ``min_buffer_size`` slightly below default 50 → earlier first audio
    - ``max_chunk_length`` slightly below default 150 → shorter synthesis chunks
    - ``pace=1.1`` matches broadcast energy (KB)
    """
    key = api_key or os.environ.get("SARVAM_API_KEY")
    if not key:
        raise ValueError(
            "SARVAM_API_KEY is required. Set it in apps/agent/.env or pass api_key=."
        )

    tts = sarvam.TTS(
        api_key=key,
        model=model,
        speaker=speaker,
        target_language_code=target_language_code,
        speech_sample_rate=speech_sample_rate,
        pace=pace,
        min_buffer_size=min_buffer_size,
        max_chunk_length=max_chunk_length,
        send_completion_event=True,
    )

    logger.info(
        "Sarvam TTS ready model=%s speaker=%s lang=%s sample_rate=%d",
        model,
        speaker,
        target_language_code,
        speech_sample_rate,
    )
    return tts


SarvamTTS = sarvam.TTS

__all__ = ["SarvamTTS", "create_sarvam_tts"]
