"""
Sarvam STT — Sudriv factory for LiveKit Agents 1.6.x

Uses the official ``livekit-plugins-sarvam`` implementation of Saaras v3.

Why not a hand-rolled SpeechStream?
-----------------------------------
A previous custom implementation broke production STT:

1. Manual ``rtc.AudioResampler.push(frame)`` — LiveKit Agents 1.6 already
   resamples inside ``RecognizeStream`` when ``sample_rate=`` is set on the
   stream. Double resampling + bad frame lifetime caused FFI
   ``Exception: null pointer`` at ``resampler.push(frame)``.

2. Wrong Sarvam protocol — expected ``type: partial|final``; real API uses
   ``type: data|events`` with nested ``data.transcript`` / VAD signals.

3. Wrong LiveKit internals — used ``_event_queue`` / ``_input``; 1.6 uses
   ``_event_ch`` / ``_input_ch`` on ``RecognizeStream``.

4. Auth / URL — outdated endpoints and headers vs ``wss://api.sarvam.ai/speech-to-text/ws``
   + ``Api-Subscription-Key``.

Correct LiveKit 1.6 custom-STT contract (if you ever re-implement):
-------------------------------------------------------------------
- Subclass ``stt.STT`` with ``STTCapabilities(streaming=True, interim_results=True)``
- Implement ``_recognize_impl`` (batch) and ``stream()`` → ``SpeechStream``
- Subclass ``stt.SpeechStream`` / ``RecognizeStream``:
  - ``super().__init__(stt=..., conn_options=..., sample_rate=16000)``
    so the framework owns resampling — **do not** call AudioResampler yourself
  - Read frames from ``self._input_ch``
  - Emit ``SpeechEvent`` via ``self._event_ch.send_nowait(...)``
  - Implement ``async def _run(self)`` (and usually reconnect in a loop)

Official plugin already does all of the above. This module only configures it
for Sudriv (Hinglish codemix, 16 kHz, conversational VAD).

See:
- knowledge-base/09-language-and-voice-pipeline.md
- https://docs.livekit.io/agents/models/stt/sarvam/
- https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/streaming-api
"""

from __future__ import annotations

import logging
import os

from livekit.plugins import sarvam

logger = logging.getLogger("sudriv-agent.plugins.sarvam_stt")

# Must match RoomIO AudioInputOptions.sample_rate in main.py so RecognizeStream
# does not insert a sox resampler between RoomIO and Sarvam.
SARVAM_STT_SAMPLE_RATE = 16000


def create_sarvam_stt(
    *,
    api_key: str | None = None,
    language: str = "hi-IN",
    model: str = "saaras:v3",
    mode: str = "codemix",
    sample_rate: int = SARVAM_STT_SAMPLE_RATE,
    high_vad_sensitivity: bool = True,
    flush_signal: bool = True,
) -> sarvam.STT:
    """
    Build a production Sarvam STT instance for the Sudriv voice pipeline.

    Args:
        api_key: Sarvam subscription key (defaults to SARVAM_API_KEY).
        language: BCP-47 code. ``hi-IN`` handles Hindi, English, and Hinglish.
        model: Prefer ``saaras:v3`` (mode control + Indic languages).
        mode: ``codemix`` for newsroom Hinglish; use ``transcribe`` for pure single-language.
        sample_rate: Must match RoomIO capture rate (16 kHz).
        high_vad_sensitivity: Faster end-of-utterance for conversational agents.
        flush_signal: Let the plugin finalize buffers when LiveKit VAD ends a turn.
    """
    key = api_key or os.environ.get("SARVAM_API_KEY")
    if not key:
        raise ValueError(
            "SARVAM_API_KEY is required. Set it in apps/agent/.env or pass api_key=."
        )

    if sample_rate <= 0:
        raise ValueError("sample_rate must be > 0")

    stt = sarvam.STT(
        api_key=key,
        language=language,
        model=model,
        mode=mode,
        sample_rate=sample_rate,
        high_vad_sensitivity=high_vad_sensitivity,
        flush_signal=flush_signal,
        # Leave input_audio_codec unset so the official plugin uses its default
        # audio/wav streaming path (validated by LiveKit for this SDK version).
    )

    logger.info(
        "Sarvam STT ready model=%s language=%s mode=%s sample_rate=%d",
        model,
        language,
        mode,
        sample_rate,
    )
    return stt


# Back-compat name used by older imports
SarvamSTT = sarvam.STT

__all__ = ["SARVAM_STT_SAMPLE_RATE", "SarvamSTT", "create_sarvam_stt"]
