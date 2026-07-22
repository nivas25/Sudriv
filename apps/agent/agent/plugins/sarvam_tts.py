"""
Sarvam TTS — production voice for Sudriv (LiveKit Agents 1.6.x).

Voice design (bulbul:v3):
  - speaker ``priya``: clear professional female (newsroom / IFB style)
  - ``en-IN``: best default for Indian English + Hinglish TTS
  - 24 kHz + 192k: higher clarity than narrowband defaults
  - pace 1.0 / temperature 0.45: natural, not rushed or random

Env overrides:
  SARVAM_TTS_SPEAKER, SARVAM_TTS_LANGUAGE, SARVAM_TTS_PACE
"""

from __future__ import annotations

import logging
import os

from livekit.plugins import sarvam

logger = logging.getLogger("sudriv-agent.plugins.sarvam_tts")

# Production defaults — tunable via env without code changes.
DEFAULT_SPEAKER = os.environ.get("SARVAM_TTS_SPEAKER", "priya")
DEFAULT_LANGUAGE = os.environ.get("SARVAM_TTS_LANGUAGE", "en-IN")
DEFAULT_PACE = float(os.environ.get("SARVAM_TTS_PACE", "1.0"))


def create_sarvam_tts(
    *,
    api_key: str | None = None,
    model: str = "bulbul:v3",
    speaker: str | None = None,
    target_language_code: str | None = None,
    speech_sample_rate: int = 24000,
    pace: float | None = None,
    temperature: float = 0.45,
    min_buffer_size: int = 35,
    max_chunk_length: int = 100,
    output_audio_bitrate: str = "192k",
    output_audio_codec: str = "mp3",
) -> sarvam.TTS:
    """
    High-quality streaming TTS for the voice agent.

    Latency knobs (production-balanced):
      min_buffer_size=35 → earlier first audio without choppy starts
      max_chunk_length=100 → shorter phrases for faster interruptibility
    """
    key = api_key or os.environ.get("SARVAM_API_KEY")
    if not key:
        raise ValueError(
            "SARVAM_API_KEY is required. Set it in apps/agent/.env or pass api_key=."
        )

    resolved_speaker = speaker or DEFAULT_SPEAKER
    resolved_lang = target_language_code or DEFAULT_LANGUAGE
    resolved_pace = DEFAULT_PACE if pace is None else pace

    tts = sarvam.TTS(
        api_key=key,
        model=model,
        speaker=resolved_speaker,
        target_language_code=resolved_lang,
        speech_sample_rate=speech_sample_rate,
        pace=resolved_pace,
        temperature=temperature,
        min_buffer_size=min_buffer_size,
        max_chunk_length=max_chunk_length,
        output_audio_bitrate=output_audio_bitrate,
        output_audio_codec=output_audio_codec,
        send_completion_event=True,
    )

    logger.info(
        "Sarvam TTS ready model=%s speaker=%s lang=%s rate=%d pace=%.2f bitrate=%s",
        model,
        resolved_speaker,
        resolved_lang,
        speech_sample_rate,
        resolved_pace,
        output_audio_bitrate,
    )
    return tts


SarvamTTS = sarvam.TTS

__all__ = ["SarvamTTS", "create_sarvam_tts", "DEFAULT_SPEAKER", "DEFAULT_LANGUAGE"]
