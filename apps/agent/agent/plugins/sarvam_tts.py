"""
Sarvam TTS — stable Hindi voice (restored production settings).
"""

from __future__ import annotations

import logging
import os

from livekit.plugins import sarvam

logger = logging.getLogger("sudriv-agent.plugins.sarvam_tts")

# Stable newsroom defaults (working 7f7ca21-era)
DEFAULT_SPEAKER = os.environ.get("SARVAM_TTS_SPEAKER", "priya")
DEFAULT_LANGUAGE = os.environ.get("SARVAM_TTS_LANGUAGE", "hi-IN")
DEFAULT_PACE = float(os.environ.get("SARVAM_TTS_PACE", "0.95"))


def create_sarvam_tts(
    *,
    api_key: str | None = None,
    model: str = "bulbul:v3",
    speaker: str | None = None,
    target_language_code: str | None = None,
    speech_sample_rate: int = 22050,
    pace: float | None = None,
    temperature: float = 0.35,
    # Slightly larger buffer = smoother playback (less chop)
    min_buffer_size: int = 50,
    max_chunk_length: int = 100,
    output_audio_bitrate: str = "128k",
    output_audio_codec: str = "linear16",
) -> sarvam.TTS:
    key = api_key or os.environ.get("SARVAM_API_KEY")
    if not key:
        raise ValueError("SARVAM_API_KEY is required.")

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

    # Avoid 10s prewarm timeout under concurrent STT connect
    pool = getattr(tts, "_pool", None)
    if pool is not None:
        pool._connect_timeout = 30.0

    logger.info(
        "TTS ready speaker=%s lang=%s rate=%d codec=%s pace=%.2f buf=%d",
        resolved_speaker,
        resolved_lang,
        speech_sample_rate,
        output_audio_codec,
        resolved_pace,
        min_buffer_size,
    )
    return tts


SarvamTTS = sarvam.TTS

__all__ = ["SarvamTTS", "create_sarvam_tts", "DEFAULT_SPEAKER", "DEFAULT_LANGUAGE"]
