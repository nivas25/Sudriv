# 09 — Language & Voice Pipeline

## Overview

Sudriv's voice pipeline is the critical path of the entire system. Audio flows from the producer's microphone through STT, LLM, TTS, and back to the producer's speakers — all within a 1-2 second target round-trip latency. Additionally, the pipeline must handle **English, Hindi, and natural Hinglish code-switching** seamlessly, which is a non-trivial requirement for most voice AI systems.

---

## Pipeline Architecture

```
Producer's Microphone
        │
        ▼
┌──────────────────┐
│  LiveKit WebRTC   │   Audio capture + transport
│  (Opus codec)     │   ~50ms latency
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  VAD (Silero)     │   Voice Activity Detection
│                   │   Detects speech start/end
│                   │   Handles interruptions
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  STT              │   Speech-to-Text
│  Sarvam Saaras v3 │   Streaming transcription
│                   │   Hindi + English + Hinglish
│                   │   200-400ms for first tokens
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  LLM              │   Language Model
│  Groq Llama 3.3   │   Intent + tool calls + response
│  70B Versatile    │   200-400ms for first token
│                   │   Streaming output
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────────────┐
│ Tools  │ │  TTS              │
│        │ │  Sarvam Bulbul v3  │
│ (async)│ │  Streaming audio   │
│        │ │  150-300ms first   │
│        │ │  chunk             │
└────────┘ └────────┬─────────┘
                    │
                    ▼
           ┌──────────────────┐
           │  LiveKit WebRTC   │
           │  Audio playback   │
           │  ~50ms latency    │
           └──────────────────┘
                    │
                    ▼
           Producer's Speakers
```

---

## STT: Sarvam Saaras v3

### Why Sarvam?

| Feature | Sarvam Saaras v3 | Google Cloud STT | Whisper |
|---------|-----------------|-----------------|---------|
| Hindi accuracy | Excellent | Good | Good |
| Hinglish code-switching | Native support | Poor | Moderate |
| Streaming mode | Yes | Yes | No (batch) |
| Latency | Low (~200ms first partial) | Low | High (batch) |
| Indian accent handling | Optimized | Good | Moderate |
| Cost | Competitive | Premium | Free (self-hosted) |

Sarvam Saaras v3 is purpose-built for Indian languages and excels at:
- Real-time streaming transcription
- Seamless code-switching between Hindi and English (Hinglish)
- Understanding Indian-accented English
- Low-latency partial results

### Configuration

```python
from livekit.plugins import sarvam  # Custom plugin wrapper if not official

stt = sarvam.STT(
    model="saaras:v3",
    language="hi-IN",         # Primary: Hindi (also handles English + Hinglish)
    sample_rate=16000,        # Standard for speech recognition
    encoding="pcm_s16le",     # 16-bit PCM
    enable_streaming=True,     # Streaming partial results
    enable_punctuation=True,   # Add punctuation for readability
    enable_itn=True,           # Inverse text normalization (numbers, dates)
)
```

### Custom LiveKit Plugin (if official plugin not available)

```python
# apps/agent/plugins/sarvam_stt.py

import aiohttp
from livekit.agents import stt


class SarvamSTT(stt.STT):
    """Custom LiveKit STT plugin for Sarvam Saaras v3."""
    
    def __init__(
        self,
        *,
        api_key: str,
        model: str = "saaras:v3",
        language: str = "hi-IN",
    ):
        super().__init__(
            capabilities=stt.STTCapabilities(streaming=True, interim_results=True)
        )
        self.api_key = api_key
        self.model = model
        self.language = language
    
    async def _recognize_impl(
        self,
        buffer: stt.AudioBuffer,
        *,
        language: str | None = None,
    ) -> stt.SpeechEvent:
        """Batch recognition (fallback)."""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.sarvam.ai/speech-to-text",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "language_code": language or self.language,
                    "audio": buffer.to_base64(),
                },
            ) as resp:
                data = await resp.json()
                return stt.SpeechEvent(
                    type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                    alternatives=[
                        stt.SpeechData(
                            text=data["transcript"],
                            language=data.get("language", self.language),
                            confidence=data.get("confidence", 0.9),
                        )
                    ],
                )

    def stream(self) -> "SarvamSTTStream":
        """Create a streaming recognition session."""
        return SarvamSTTStream(self)


class SarvamSTTStream(stt.SpeechStream):
    """Streaming STT using Sarvam's WebSocket API."""
    
    def __init__(self, stt_instance: SarvamSTT):
        super().__init__(stt=stt_instance)
        self._stt = stt_instance
    
    async def _run(self):
        """WebSocket streaming loop."""
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(
                "wss://api.sarvam.ai/speech-to-text/streaming",
                headers={"Authorization": f"Bearer {self._stt.api_key}"},
            ) as ws:
                # Send config
                await ws.send_json({
                    "model": self._stt.model,
                    "language_code": self._stt.language,
                    "enable_interim_results": True,
                })
                
                # Process audio frames
                async for frame in self._input:
                    await ws.send_bytes(frame.data)
                    
                    # Check for results
                    try:
                        msg = await asyncio.wait_for(ws.receive_json(), timeout=0.01)
                        if msg.get("type") == "partial":
                            self._event_queue.put_nowait(
                                stt.SpeechEvent(
                                    type=stt.SpeechEventType.INTERIM_TRANSCRIPT,
                                    alternatives=[
                                        stt.SpeechData(
                                            text=msg["transcript"],
                                            language=msg.get("language", "hi-IN"),
                                        )
                                    ],
                                )
                            )
                        elif msg.get("type") == "final":
                            self._event_queue.put_nowait(
                                stt.SpeechEvent(
                                    type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                                    alternatives=[
                                        stt.SpeechData(
                                            text=msg["transcript"],
                                            language=msg.get("language", "hi-IN"),
                                            confidence=msg.get("confidence", 0.9),
                                        )
                                    ],
                                )
                            )
                    except asyncio.TimeoutError:
                        pass
```

---

## LLM: Groq Llama 3.3 70B

### Why Groq?

| Feature | Groq | OpenAI GPT-4o | Anthropic Claude |
|---------|------|--------------|-----------------|
| Latency (TTFT) | ~200ms | ~500ms | ~600ms |
| Tokens/sec | 300+ | ~100 | ~80 |
| Function calling | Yes | Yes | Yes |
| Hindi/Hinglish | Good (via Llama) | Good | Good |
| Cost per 1M tokens | $0.59 (input) | $2.50 (input) | $3.00 (input) |
| Self-hosted option | No | No | No |

Groq's primary advantage is **speed**. For a voice pipeline where the LLM is in the critical path, TTFT (Time to First Token) and tokens/sec directly impact perceived latency.

### Configuration

```python
from livekit.plugins import groq

llm = groq.LLM(
    model="llama-3.3-70b-versatile",
    temperature=0.3,           # Low temperature for precision and consistency
    max_tokens=500,            # Keep responses concise for voice
    top_p=0.9,
)
```

### LLM Behavior Tuning

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `temperature` | 0.3 | Low creativity, high precision — critical for tool calls and timeline accuracy |
| `max_tokens` | 500 | Voice responses should be short; prevents rambling |
| `top_p` | 0.9 | Slightly constrained for more predictable outputs |
| Streaming | Always on | TTS begins as soon as first tokens arrive |

### Tool Call Reliability

Llama 3.3 70B has strong function calling capabilities, but additional guardrails are needed:

1. **Schema validation**: Every tool call response is validated against the expected schema before execution
2. **Retry on malformed calls**: If the LLM produces an invalid tool call, retry once with a correction prompt
3. **Fallback responses**: If tool calls consistently fail, the agent falls back to natural language without tools

---

## TTS: Sarvam Bulbul v3

### Why Sarvam Bulbul?

| Feature | Sarvam Bulbul v3 | ElevenLabs | Google Cloud TTS |
|---------|-----------------|------------|-----------------|
| Indian English quality | Excellent | Good | Good |
| Hindi quality | Excellent | Limited | Good |
| Hinglish naturalness | Native | Poor | Poor |
| Streaming | Yes | Yes | Limited |
| Voice cloning | Limited | Yes | No |
| Latency | Low (~150ms first chunk) | Low | Moderate |

### Configuration

```python
from livekit.plugins import sarvam  # Custom plugin wrapper

tts = sarvam.TTS(
    model="bulbul:v3",
    voice="meera",              # Natural Indian English female voice
    sample_rate=24000,          # High quality audio
    speaking_rate=1.1,          # Slightly faster for broadcast pace
    pitch=0,                    # Default pitch
    enable_streaming=True,       # Stream audio chunks
)
```

### Voice Selection

For the MVP, we use a single voice. Suggested characteristics:
- **Clear and professional** — broadcast-quality diction
- **Neutral Indian English accent** — natural but universally understandable
- **Moderate pace** — slightly faster than conversational, matching broadcast energy
- **Warm but authoritative** — the producer needs to trust this voice

### Custom LiveKit Plugin (if official plugin not available)

```python
# apps/agent/plugins/sarvam_tts.py

import aiohttp
from livekit.agents import tts


class SarvamTTS(tts.TTS):
    """Custom LiveKit TTS plugin for Sarvam Bulbul v3."""
    
    def __init__(
        self,
        *,
        api_key: str,
        model: str = "bulbul:v3",
        voice: str = "meera",
        speaking_rate: float = 1.1,
    ):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=True),
            sample_rate=24000,
            num_channels=1,
        )
        self.api_key = api_key
        self.model = model
        self.voice = voice
        self.speaking_rate = speaking_rate
    
    def synthesize(self, text: str) -> "SarvamTTSStream":
        return SarvamTTSStream(self, text)


class SarvamTTSStream(tts.SynthesizeStream):
    """Streaming TTS synthesis."""
    
    def __init__(self, tts_instance: SarvamTTS, text: str):
        super().__init__(tts=tts_instance)
        self._tts = tts_instance
        self._text = text
    
    async def _run(self):
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.sarvam.ai/text-to-speech/streaming",
                headers={
                    "Authorization": f"Bearer {self._tts.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._tts.model,
                    "text": self._text,
                    "voice": self._tts.voice,
                    "speaking_rate": self._tts.speaking_rate,
                    "response_format": "pcm",
                    "sample_rate": 24000,
                },
            ) as resp:
                async for chunk in resp.content.iter_chunked(4096):
                    self._event_queue.put_nowait(
                        tts.SynthesizedAudio(
                            frame=rtc.AudioFrame(
                                data=chunk,
                                sample_rate=24000,
                                num_channels=1,
                                samples_per_channel=len(chunk) // 2,
                            ),
                        )
                    )
```

---

## Voice Activity Detection (VAD)

### Silero VAD

LiveKit's default VAD uses the **Silero** model, which is efficient and accurate.

```python
from livekit.plugins import silero

vad = silero.VAD.load(
    min_speech_duration=0.1,    # Minimum speech length to trigger
    min_silence_duration=0.3,   # Silence before considering speech ended
    prefix_padding=0.5,         # Audio to keep before speech start
    activation_threshold=0.5,   # Confidence threshold
)
```

### Interruption Handling

LiveKit's `VoicePipelineAgent` supports adaptive interruption:

```python
agent = VoicePipelineAgent(
    # ...
    allow_interruptions=True,
    interrupt_speech_duration=0.5,   # Producer must speak for 500ms to interrupt
    interrupt_min_words=1,            # Minimum 1 word detected to count as interruption
    min_endpointing_delay=0.5,       # Wait 500ms of silence before considering turn complete
)
```

**Interruption behavior:**

| Producer Action | System Response |
|----------------|-----------------|
| Short sound (< 500ms, "hmm") | Agent pauses briefly, then continues |
| Clear speech (> 500ms, 1+ words) | Agent stops talking, begins listening |
| Rapid interjection during agent speech | Agent cuts off immediately, listens |
| Producer says "wait" | Agent pauses and waits for next instruction |
| Producer says "go on" / "continue" | Agent resumes from where it left off |

---

## Language Handling

### The Hinglish Challenge

"Hinglish" is the natural code-switching between Hindi and English that is ubiquitous in Indian professional environments. Examples:

| Hinglish | English Translation |
|----------|-------------------|
| "Earthquake story ko slot 3 mein daal do" | "Put the earthquake story in slot 3" |
| "Sports waali story hata do timeline se" | "Remove the sports story from the timeline" |
| "Kitna time extra lag raha hai?" | "How much extra time is it taking?" |
| "Theek hai, apply karo" | "Okay, apply it" |
| "Breaking news aaya hai earthquake ka" | "Breaking news has come about the earthquake" |

### Language Strategy

1. **STT (Sarvam Saaras v3)**: Set to `hi-IN` which natively handles Hindi, English, and Hinglish input. No language detection needed.

2. **LLM (Groq Llama 3.3 70B)**: The system prompt instructs the model to match the producer's language. If the producer speaks in Hinglish, the LLM responds in Hinglish.

3. **TTS (Sarvam Bulbul v3)**: Natively handles mixed Hindi-English text. The voice sounds natural regardless of language mix.

### Language Matching Rules (in System Prompt)

```
- If the producer speaks in English → respond in English
- If the producer speaks in Hindi → respond in Hindi
- If the producer speaks in Hinglish → respond in Hinglish
- For technical terms (segment, running order, timeline, teleprompter, slot) → 
  always use English, even in Hindi/Hinglish conversation
- For numbers → match the producer's style 
  ("teen minute" if they say Hindi numbers, "3 minutes" if they use English)
```

---

## End-to-End Latency Optimization

### Streaming Pipeline

The key optimization is that **each stage starts as soon as the previous stage produces its first output**, not when the previous stage completes.

```
Time ──────────────────────────────────────────────────────▶

Producer speaks:     |████████████████|
                              │
STT streaming:               |██partial██|█final█|
                                   │
LLM streaming:                     |██token██token██token██|
                                     │
TTS streaming:                       |█chunk█chunk█chunk█|
                                       │
Agent speaks:                          |████████████████████|

Total time from end-of-speech to start-of-response: ~800ms-1.2s
```

### Optimization Techniques

| Technique | Effect | Implementation |
|-----------|--------|---------------|
| Streaming STT | Reduces wait for full transcription | Sarvam streaming API |
| Streaming LLM | TTS starts before LLM finishes | Groq streaming responses |
| Streaming TTS | Audio plays before synthesis completes | Sarvam streaming API |
| Pre-warmed VAD | No cold start on first speech | `prewarm_fnc` in worker |
| Connection pooling | No per-request connection overhead | Persistent Redis + Supabase connections |
| Edge Redis (Upstash) | Minimal network latency for cache ops | Upstash global edge deployment |
| LLM context pruning | Faster LLM inference with smaller context | Periodic conversation summarization |

### Latency Monitoring

The agent should log timestamps at each pipeline stage for monitoring:

```python
import time

class LatencyTracker:
    def __init__(self):
        self.timestamps = {}
    
    def mark(self, stage: str):
        self.timestamps[stage] = time.monotonic()
    
    def report(self) -> dict:
        stages = list(self.timestamps.keys())
        result = {}
        for i in range(1, len(stages)):
            delta = self.timestamps[stages[i]] - self.timestamps[stages[i-1]]
            result[f"{stages[i-1]}→{stages[i]}"] = round(delta * 1000, 1)
        
        if len(stages) >= 2:
            result["total"] = round(
                (self.timestamps[stages[-1]] - self.timestamps[stages[0]]) * 1000, 1
            )
        return result

# Usage in the voice pipeline:
# tracker.mark("speech_end")
# tracker.mark("stt_final")
# tracker.mark("llm_first_token")
# tracker.mark("tts_first_chunk")
# tracker.mark("audio_playback_start")
# logger.info(f"Latency: {tracker.report()}")
```

---

## Audio Quality Considerations

### Input (Producer → Agent)
- **Codec**: Opus (via WebRTC)
- **Sample rate**: 48kHz capture, downsampled to 16kHz for STT
- **Channels**: Mono
- **Noise suppression**: LiveKit built-in noise suppression (krisp)
- **Echo cancellation**: WebRTC AEC

### Output (Agent → Producer)
- **Codec**: Opus (via WebRTC)
- **Sample rate**: 24kHz from TTS, upsampled for Opus
- **Channels**: Mono
- **Volume normalization**: Ensure consistent volume across responses

### PCR Environment Considerations
- **Background noise**: Production control rooms have significant background noise (multiple screens, intercoms, other staff). Noise suppression is critical.
- **Microphone type**: Expect headset microphones (directional) which help isolate the producer's voice.
- **Latency sensitivity**: PCR staff are trained to work with sub-second IFB latency. Anything above 2 seconds feels "broken".
