"""
Sarvam TTS Plugin — Bulbul v3

Custom LiveKit TTS plugin wrapping the Sarvam Bulbul v3 API.
Natural Indian English + Hindi voice synthesis with streaming.

See: knowledge-base/09-language-and-voice-pipeline.md (TTS Section)

TODO: Implement full streaming TTS plugin
"""

import logging

logger = logging.getLogger("sudriv-agent.plugins.sarvam_tts")


# TODO: Implement SarvamTTS class extending livekit.agents.tts.TTS
# See knowledge-base/09-language-and-voice-pipeline.md for the full implementation template
#
# class SarvamTTS(tts.TTS):
#     def __init__(self, *, api_key: str, model: str = "bulbul:v3", voice: str = "meera"):
#         ...
#     def synthesize(self, text: str) -> SarvamTTSStream:
#         ...
