# Open-Source / Self-Hostable TTS Engines — Deep Research

> Purpose: pick engines for a self-hosted "premium TTS layer" in a voice-generation SaaS.
> Research date: 2026-08-10. Star counts / Elo ratings as of that date.
> Sources: GitHub API, HuggingFace model cards (API + pages), speech.dev model directory, Artificial Analysis Speech Arena leaderboard, project READMEs.

---

## 1. TL;DR — Master comparison table

Legend: ✅ = commercial use OK, ❌ = non-commercial/copyleft problem for SaaS, ⚠️ = commercial with conditions.
Elo = Artificial Analysis **Speech Arena** Elo (blind user votes). Only ~15 of 92 ranked models are open-weights.

| Engine | Repo (GitHub) | Stars | Code license | **Weights license** | Quality (Elo) | Clone | Hardware (inference) | RTF / latency | Production-ready |
|---|---|---|---|---|---|---|---|---|---|
| **Kokoro-82M** | [hexgrad/kokoro](https://github.com/hexgrad/kokoro) · weights [hf.co/hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | 8.4k | Apache-2.0 | **Apache-2.0** ✅ | **1056** (AA) | No (54 fixed voices) | CPU real-time; ~0.5 GB | RTF ~0.1 CPU, <0.02 GPU | **Yes** — tiny, fast, permissive |
| **edge-tts** | [rany2/edge-tts](https://github.com/rany2/edge-tts) | 11.7k | **LGPL-3.0** | n/a (cloud endpoint, no weights) | ~Azure-grade (not arena-ranked; Edge voices ≈ Azure) | No | None (network) | ~150–500 ms | Risky — unofficial MS endpoint, ToS grey zone |
| **Piper** | [rhasspy/piper](https://github.com/rhasspy/piper) | 11.3k | MIT | **Voices mixed** (many CC-BY, several non-commercial) | not arena-ranked (lower MOS) | No | CPU / Raspberry Pi | RTF <0.1 CPU | Yes (but per-voice license check needed) |
| **Coqui XTTS-v2** | [coqui-ai/TTS](https://github.com/coqui-ai/TTS) | 45.9k | MPL-2.0 | **Coqui Public Model License — NON-COMMERCIAL** ❌ | **914** (AA) | ✅ zero-shot (6 s ref) | ~4 GB VRAM | RTF ~0.15 GPU | Company shut down; fork: [idiap/coqui-ai-TTS](https://github.com/idiap/coqui-ai-TTS) |
| **CosyVoice 2 / 3** | [QwenAudio/CosyVoice](https://github.com/QwenAudio/CosyVoice) (ex-FunAudioLLM) | 22.7k | Apache-2.0 | **Apache-2.0** ✅ | not arena-ranked (top-tier per evals) | ✅ zero-shot + streaming | 0.5B: ~3–4 GB | RTF ~0.1 GPU; streaming | **Yes** — actively maintained, full-stack (train/deploy/API) |
| **F5-TTS** | [SWivid/F5-TTS](https://github.com/SWivid/F5-TTS) | 15.1k | MIT | **CC-BY-NC-4.0** ❌ (Emilia data) | not arena-ranked (≈above XTTS in evals) | ✅ zero-shot | ~4 GB VRAM | 0.147 PyTorch / 0.04 TRT-LLM (L20) | Mostly; NC weights block SaaS |
| **E2-TTS** | code inside F5-TTS repo; [paper](https://arxiv.org/abs/2406.18009) | — | MIT (code) | CC-BY-NC-4.0 ❌ | ~XTTS-class | ✅ zero-shot | ~4 GB VRAM | RTF ~0.14 | Research-grade; NC weights |
| **ChatTTS** | [2noise/ChatTTS](https://github.com/2noise/ChatTTS) | 39.8k | **AGPL-3.0** ❌ | **CC BY-NC 4.0** ❌ | not arena-ranked | No (seed-based) | ~4 GB VRAM | ~0.2 GPU | No for SaaS (copyleft + NC) |
| **GPT-SoVITS** | [RVC-Boss/GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) | **60.7k** | MIT | MIT code; **official voices non-commercial** per README; community ckpts vary | not arena-ranked (community fav) | ✅ few-shot (1 min data) | ~4 GB VRAM | ~0.1–0.3 GPU | WebUI + API; strong cloning, OK quality |
| **Fish Speech** | [fishaudio/fish-speech](https://github.com/fishaudio/fish-speech) | 32.1k | BSD-3-Clause | **CC-BY-NC-SA-4.0** ❌ (paid commercial license via fish.audio) | OpenAudio S1: **1066**, S2 Pro (open): **1121** | ✅ zero-shot | ~6 GB VRAM | RTF ~0.05–0.1 | Yes technically; **NC weights → need license for SaaS** |
| **Bark** | [suno-ai/bark](https://github.com/suno-ai/bark) | 39.2k | MIT | **CC-BY-NC-4.0** ❌ | not arena-ranked | No | ~4 GB VRAM (slow) | RTF ~5–10 (very slow) | No — abandoned, slow, NC weights |
| **Tortoise TTS** | [neonbjb/tortoise-tts](https://github.com/neonbjb/tortoise-tts) | 14.9k | Apache-2.0 | Apache-2.0 (repo weights) | not arena-ranked | ✅ few-shot | ~6 GB VRAM | RTF ~10 (very slow) | No — too slow for SaaS |
| **StyleTTS 2** | [yl4579/StyleTTS2](https://github.com/yl4579/StyleTTS2) | 6.3k | MIT | MIT (LJSpeech ckpt) | **888** (AA) | Partial (speaker adaptation) | CPU-capable | RTF ~0.05 | Yes for fixed voices; no true zero-shot clone |
| **MeloTTS** | [myshell-ai/MeloTTS](https://github.com/myshell-ai/MeloTTS) | 7.6k | MIT | MIT | not arena-ranked (low) | No | CPU real-time | RTF ~0.1 CPU | Yes (simple voices only) |
| **Mimic 3** | [MycroftAI/mimic3](https://github.com/MycroftAI/mimic3) | 1.3k | **AGPL-3.0** ❌ | mixed (VCTK etc.) | not arena-ranked (low) | No | CPU | RTF <0.5 | Stale; AGPL; skip |
| **OpenVoice V2** | [myshell-ai/OpenVoice](https://github.com/myshell-ai/OpenVoice) | 37.1k | MIT | **MIT (V2)** ✅ | **948** (AA) | ✅ instant tone-color cloning | CPU-ish / small GPU | RTF ~0.1 | Yes as *voice-conversion layer* over another TTS |
| **Parler TTS** | [huggingface/parler-tts](https://github.com/huggingface/parler-tts) | 5.6k | Apache-2.0 | Apache-2.0 (parler large v0.1) | not arena-ranked (below avg) | No (prompt-description) | ~3–6 GB VRAM | RTF ~1–2 | Specs fine, quality not premium |
| **SeamlessM4T v2** | [facebookresearch/seamless_communication](https://github.com/facebookresearch/seamless_communication) | 11.8k | MIT (code) | **CC-BY-NC-4.0** ❌ | not arena-ranked | No | 2.3B params ~16 GB | slow | Translation-focused; NC weights; skip |
| **IndexTTS / IndexTTS2** | [index-tts/index-tts](https://github.com/index-tts/index-tts) | **22.5k** | MIT | **bilibili Model Use License** (custom; commercial OK under thresholds) ⚠️ | not arena-ranked (≈top-tier zero-shot per evals) | ✅ zero-shot | ~6–8 GB VRAM | RTF ~0.1 | **Yes** — commercial-friendly, vLLM runtime exists |
| **Zonos** | [Zyphra/Zonos](https://github.com/Zyphra/Zonos) | 7.2k | Apache-2.0 | **Apache-2.0** ✅ | **1000** (AA) | ✅ zero-shot | 1.6B (~10 GB bf16) | RTF ~0.3–0.4 | Yes (solid; long-form issues reported) |
| **Qwen3-TTS** | [QwenLM/Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) | **12.9k** | Apache-2.0 | **Apache-2.0** ✅ | API siblings 915–935 (AA); open 12Hz not separately ranked | ✅ 3-s clone + voice design | 0.6B/1.7B: ~4/8 GB | **97 ms first-packet streaming** | **Yes** — best-in-class open LLM-TTS; vLLM-Omni day-0 |

---

## 2. Quality rankings — where open models sit (critical for a "premium" tier)

### 2.1 Artificial Analysis Speech Arena — https://artificialanalysis.ai/text-to-speech/arena

Top of the board is proprietary: Qwen-Audio-3.0-TTS-Plus (1229), Simba 3.2 (1227), Gemini 3.1 Flash TTS (1210), Luna TTS (1209), Cartesia Sonic 3.5 (1203), MiniMax Speech 2.8 HD (1172), ElevenLabs Eleven v3 (1171).

**Open-weights models on the leaderboard (of 92 total):**

| Arena rank | Open model | Elo | Notes |
|---|---|---|---|
| 24 | Fish Audio **S2 Pro** | **1121** | highest open-weights entry |
| 26 | StepFun **Step Audio EditX** | 1109 | open weights (Feb 2026) |
| 41 | OpenAudio **S1** (fishaudio) | 1066 | open weights |
| 40 | Mistral **Voxtral** | 1067 | open weights |
| 43 | NVIDIA **Magpie-Multilingual 357M** | 1065 | open weights, 5 voices |
| 49 | **Kokoro 82M v1.0** | **1056** | cheapest model on the entire board (~$0.65 /1M chars via APIs) |
| 57 | **Maya1** | 1042 | open weights |
| 60 | Boson **Higgs Audio V3 TTS** | 1036 | open weights |
| 70 | **Chatterbox** (Resemble AI) | 1014 | open weights |
| 73 | **Zonos-v0.1** (Zyphra) | **1000** | open weights, mid-pack |
| 77 | MS **VibeVoice 7B** | 957 | open weights |
| 78 | **OpenVoice v2** | 948 | open weights |
| 83 | **XTTS v2** (Coqui) | **914** | open weights |
| 86 | **StyleTTS 2** | **888** | open weights |
| 91 | **MetaVoice v1** | 833 | open weights |

Takeaways:
- **Kokoro (1056) beats XTTS-v2 (914) and StyleTTS 2 (888) by a wide margin while being ~100× smaller.**
- Fish/OpenAudio and Step are the only open families above 1100 Elo.
- Qwen3-TTS open (12Hz) isn't individually ranked; its API-served siblings sit at 915–935.
- The gap between the best open model (1121) and proprietary SOTA (1229) is real but shrinking; a "premium" tier built on open weights can honestly claim ~top-25-of-92 quality, not #1.

### 2.2 speech.dev — https://www.speech.dev/models?type=TTS

Crowd-sourced model directory (AA-indexed where available). Open models present: Kokoro 82M v1.0 (free), XTTS v2 (free), Zonos-v0.1 (free), OpenVoice v2 (free), StyleTTS 2 (free), Fish Speech 1.5 / S2 Pro (API), Qwen3 (API). Open models sit below the premium commercial tier (Cartesia Sonic Turbo ~40 ms p50 latency, Rime, ElevenLabs, MiniMax) on both quality and latency.

### 2.3 Community arenas

- **TTS-Spaces-Arena** (HF space by Pendrokar) — source of most open-model Elo data used by AA and speech.dev.
- **TTS-AGI/TTS-Arena** (HF) — open-model ranking incl. Kokoro, F5-TTS, CosyVoice2, GPT-SoVITS, Fish Speech, XTTS.

### 2.4 Notable comparison articles / benchmarks (2025–2026)

- AA Speech Arena FAQ: best open-weights TTS → Fish S2 Pro (1121), Step Audio EditX (1109), Voxtral (1067), Magpie (1065), Kokoro (1056).
- Qwen3-TTS technical report (WER↓ on Seed-TTS zh/en): CosyVoice3 0.71/1.45, **Qwen3-TTS-12Hz-1.7B 0.77/1.24** (best open), F5-TTS 1.56/1.83, E2-TTS 1.97/2.19, MaskGCT 2.27/2.62 → **Qwen3-TTS-12Hz and CosyVoice3 are the content-accuracy leaders among open zero-shot models**.
- Community consensus (LocalLLaMA etc., 2025–2026): Kokoro = best per-dollar CPU model; IndexTTS2 / Qwen3-TTS = best zero-shot clone quality; Fish/OpenAudio = best general open quality.

---

## 3. Engine-by-engine details

### 3.1 edge-tts — https://github.com/rany2/edge-tts (11.7k ⭐)

- **What**: Python wrapper around Microsoft Edge's hosted neural TTS endpoint (free, no API key, no Edge/Windows needed). ~500+ voices, 100+ languages, SSML, MP3/WebM output, CLI + WebSocket streaming.
- **License**: **LGPL-3.0** (verified LICENSE file; `srt_composer.py` MIT). LGPL is SaaS-safe when used as an unmodified library.
- **Quality**: Azure-grade neural voices — better than most open models, on par with mid-tier commercial TTS.
- **Cloning**: no. **Hardware**: none (network call), latency ~150–500 ms.
- **Production caveats**: the endpoint is **Microsoft's property; this is an unofficial wrapper**. MS ToS does not authorize commercial redistribution of these voices — a paid SaaS built on it is a legal grey zone, and the endpoint can break / rate-limit / change without notice. Perfect for MVPs, prototypes and personal tools; a compliance/stability risk for a paid product.
- **Servers**: pip package + CLI; community FastAPI wrappers (e.g. [islamlnwzy/Edge-TTS-API](https://github.com/islamlnwzy/Edge-TTS-API)); Docker images available via community packaging.

### 3.2 Kokoro-82M — https://github.com/hexgrad/kokoro (8.4k ⭐; weights https://huggingface.co/hexgrad/Kokoro-82M)

- **What**: 82M-param StyleTTS2-architecture model trained for ~$1k on permissive/public-domain data. ~11.5M HF downloads/month — among the most-deployed open TTS models ever.
- **License**: **Apache-2.0 for code AND weights** ✅ (verified HF card). Author explicitly welcomes commercial deployment ("deployed in numerous projects and commercial APIs").
- **Quality**: AA Speech Arena **Elo 1056** — above all small open models and XTTS-v2.
- **Languages/voices**: v1.0 = **8 languages, 54 voices** (English, Chinese, Japanese, Korean, Spanish, French, Italian, Portuguese). Legacy v0.19 = English only.
- **Cloning**: no zero-shot cloning; 50+ fine-tunes and 9 adapters exist on HF.
- **Hardware**: CPU real-time (RTF ~0.1 CPU, <0.02 GPU), ~0.5 GB RAM. Requires `espeak-ng` system package for phonemization.
- **Maturity**: production-proven (DeepInfra, Replicate, fal + dozens of apps). `kokoro` pip package + `misaki` G2P. **No official inference server** — pair with FastAPI or use community wrappers (e.g. `koesn/kokoro-fastapi`).
- **Verdict**: the obvious workhorse for a premium-layer MVP on cheap CPU nodes.

### 3.3 Piper — https://github.com/rhasspy/piper (11.3k ⭐, **archived**)

- **What**: ultra-fast local neural TTS (VITS + ONNX), designed for Raspberry Pi / offline / Assist.
- **License**: code **MIT**; **voices individually licensed** — many CC-BY (commercial OK with attribution) but several voices are non-commercial/restricted. Must check per voice in [rhasspy/piper-voices](https://github.com/rhasspy/piper-voices) (`voices.json`).
- **Quality**: fine for IVR/assistants, clearly below "premium" (22 kHz, not arena-ranked, ~3.9–4.2 MOS territory).
- **Cloning**: no. ~50 languages with community voices.
- **Hardware**: CPU/RPi real-time; RTF <0.1 on modern CPU; models ~20–100 MB.
- **Maturity**: very stable, but repo archived (2025) — maintenance now thin. Good as a cheap fallback tier, not the premium tier.

### 3.4 Coqui XTTS-v2 — https://github.com/coqui-ai/TTS (45.9k ⭐)

- **What**: the classic zero-shot voice-cloning model (~467M params); 6–10 s reference audio, 17 languages.
- **License**: code **MPL-2.0**; **weights = Coqui Public Model License (CPML) — NON-COMMERCIAL** ❌ (verified HF card `coqui/XTTS-v2` → license_name `coqui-public-model-license`). The CPML explicitly forbids commercial use → **cannot power a paid SaaS**.
- **Quality**: AA Elo **914** — solid but clearly behind Kokoro; aging.
- **Hardware**: ~4 GB VRAM; RTF ~0.15 GPU. **Maturity**: Coqui shut down Jan 2024; community fork [idiap/coqui-ai-TTS](https://github.com/idiap/coqui-ai-TTS) (Apache-2.0 code, but XTTS-v2 weights remain CPML). Servers: `xtts-api-server` (FastAPI, community), Gradio.
- **Verdict**: great for personal/tooling use; **license blocks commercial use** — use Qwen3-TTS/CosyVoice/IndexTTS for commercial cloning instead.

### 3.5 CosyVoice 2 / 3 — https://github.com/QwenAudio/CosyVoice (22.7k ⭐, ex-FunAudioLLM org)

- **What**: Alibaba's full-stack multilingual voice generation suite. CosyVoice2 (0.5B, 2024) = LLM + flow matching + hift vocoder; zero-shot cloning from 3–10 s ref, cross-lingual, **streaming** (CosyVoice2 + S2.5 token stream). **CosyVoice3** (Oct 2025) — SOTA-quality multilingual (zh/en/ja/ko/yue + more), strongly steerable.
- **License**: **Apache-2.0 code AND weights** ✅ (verified: repo Apache-2.0; `FunAudioLLM/CosyVoice2-0.5B` HF card apache-2.0). Commercial use allowed.
- **Quality**: not arena-ranked; in Qwen3-TTS evals it leads open models on content accuracy (0.71/1.45 WER on Seed-TTS zh/en). Community arena (TTS-Spaces) places CosyVoice2 ≈ XTTS-class.
- **Cloning**: yes — zero-shot, cross-lingual, plus speech-to-speech voice conversion.
- **Hardware**: 0.5B model ≈ 3–4 GB VRAM fp16; RTF ~0.1 on A10/3090-class; streaming via built-in engine.
- **Maturity**: actively maintained (pushed 2026-05), official `runtime` FastAPI server, Docker images, Gradio, training + finetuning scripts, modelscope/HF hosting. Known issues: 735 open issues, some dependency friction, Chinese-centric docs.
- **Verdict**: top choice for a commercial zero-shot + streaming layer.

### 3.6 F5-TTS — https://github.com/SWivid/F5-TTS (15.1k ⭐)

- **What**: flow-matching (conditional diffusion) zero-shot TTS, ConvNeXtV2 + DiT; English + Chinese base; multilingual via in-context learning.
- **License**: code **MIT**; **pre-trained weights CC-BY-NC-4.0** ❌ (README: "licensed under CC-BY-NC ... due to the training data Emilia"). → commercial SaaS use not permitted without rightsholder permission.
- **Quality**: not arena-ranked; Seed-TTS WER 1.56/1.83 (worse than CosyVoice3/Qwen3, better than E2/XTTS in that eval). Zero-shot similarity is strong.
- **Hardware**: ~4 GB VRAM; official benchmark on L20: RTF **0.147 offline PyTorch, 0.04 with TensorRT-LLM**, avg latency 253 ms @ 2 concurrency.
- **Maturity**: production-oriented — Docker image `ghcr.io/swivid/f5-tts:main`, Gradio app, Triton+TensorRT-LLM runtime, ONNX port, active development (pushed 2026-07).
- **Verdict**: excellent engine, blocked for SaaS by NC weights.

### 3.7 E2-TTS — (official standalone repo removed; code kept inside F5-TTS; paper https://arxiv.org/abs/2406.18009)

- **What**: "Embarrassingly Easy" fully non-autoregressive zero-shot TTS (Flat-UNet Transformer + CFM), NVIDIA. F5-TTS's simpler sibling.
- **License**: MIT code; weights CC-BY-NC-4.0 ❌ (same hosting). Community implementations: `lucidrains/e2-tts-pytorch` (MIT, 517 ⭐), `bfs18/e2_tts`.
- **Quality**: below F5-TTS (Seed-TTS WER 1.97/2.19) but above XTTS-class in some evals. **Cloning**: zero-shot.
- **Hardware**: ~4 GB VRAM. **Maturity**: research-grade; no first-class serving stack anymore. Skip for SaaS; useful as a reference.

### 3.8 ChatTTS — https://github.com/2noise/ChatTTS (39.8k ⭐)

- **What**: conversational/expressive Chinese+English TTS; famed for emotional, "chatty" output and voice seeds.
- **License**: code **AGPL-3.0** ❌ (copyleft — network use triggers source obligations); weights **CC BY-NC 4.0** ❌ (README: models for academic/non-commercial use). Double-blocked for SaaS.
- **Quality**: not arena-ranked; human-like prosody but mediocre stability on long text. **Cloning**: no (seed/random voice).
- **Hardware**: ~4 GB VRAM; RTF ~0.2 GPU.
- **Maturity**: webui + Gradio; development slowed after initial hype. **Verdict: skip for a commercial product.**

### 3.9 GPT-SoVITS — https://github.com/RVC-Boss/GPT-SoVITS (60.7k ⭐)

- **What**: few-shot voice cloning ("1 min of voice data"); Chinese/English/Japanese/Korean/Cantonese; integrated WebUI with training pipeline, plus `api_v2.py` FastAPI server.
- **License**: **MIT** code ✅; official pretrained voices are **non-commercial** per README (community-trained checkpoints vary; check per model). Code is MIT → you *can* legally train your own voice from licensed data and serve it commercially.
- **Quality**: not arena-ranked; good clone similarity, but output quality/robustness trails modern zero-shot models (esp. prosody & long text).
- **Hardware**: ~4 GB VRAM inference; small models are CPU-capable; fine-tune training on consumer GPU (1 min audio → ~1 min training).
- **Maturity**: very active (885 open issues), huge community, docs in Chinese-first; good few-shot pipeline but a heavier ops burden than zero-shot models.
- **Verdict**: the best *few-shot fine-tune* engine; use for customer voice models when zero-shot quality isn't enough.

### 3.10 Fish Speech — https://github.com/fishaudio/fish-speech (32.1k ⭐) · API https://fish.audio

- **What**: VQGAN + LLAMA-based dual-AR TTS; zero-shot cloning; Fish Speech 1.5 (13 languages), plus the OpenAudio S1 family (SOTA-grade open models, Elo 1066/1121).
- **License**: code **BSD-3-Clause**; **weights CC-BY-NC-SA-4.0** ❌ (verified HF card `fishaudio/fish-speech-1.5` — extra gated checkbox "non-commercial use ONLY"). **Commercial use requires a paid license from Fish Audio** (business@fish.audio); they also sell the hosted API.
- **Quality**: OpenAudio S1 = **Elo 1066**, S2 Pro = **1121 (best open model on the board)**.
- **Cloning**: yes, zero-shot. 13 languages (v1.5).
- **Hardware**: ~6 GB VRAM fp16 (1B class); RTF ~0.05–0.1.
- **Maturity**: active, clean codebase, Gradio + FastAPI demo servers, Docker images.
- **Verdict**: top-tier quality; either budget a commercial license from fish.audio or treat as research-only.

### 3.11 Bark — https://github.com/suno-ai/bark (39.2k ⭐)

- **What**: Suno's early generative audio model (GPT-style + fine codec); music/paralinguistics, prompt-driven voices.
- **License**: code MIT; **weights CC-BY-NC-4.0** ❌.
- **Quality**: interesting prosody, but unstable content adherence; not arena-ranked. **Cloning**: no.
- **Hardware**: ~4 GB VRAM; RTF ~5–10 (very slow). **Maturity**: effectively abandoned (last push 2024-08).
- **Verdict**: skip.

### 3.12 Tortoise TTS — https://github.com/neonbjb/tortoise-tts (14.9k ⭐)

- **What**: the 2022–2023 quality king; autoregressive + diffusion; few-shot cloning from short refs.
- **License**: code Apache-2.0; repo weights Apache-2.0 (verify per checkpoint).
- **Quality**: still decent, clearly surpassed; not arena-ranked. **Cloning**: yes, few-shot.
- **Hardware**: ~6 GB VRAM; **RTF ~10** (unusably slow at SaaS scale). **Maturity**: stale (last push 2024-11).
- **Verdict**: skip for production; historical reference.

### 3.13 StyleTTS 2 — https://github.com/yl4579/StyleTTS2 (6.3k ⭐)

- **What**: style diffusion + adversarial training; near-human naturalness for fixed voices; speaker adaptation via ~1 min audio.
- **License**: **MIT** code; MIT-style weights (LJSpeech checkpoint). ✅
- **Quality**: AA **Elo 888**; on LJSpeech it reached human-level MOS in its paper. **Cloning**: adaptation (not true zero-shot).
- **Hardware**: CPU-capable; RTF ~0.05 GPU.
- **Maturity**: stagnant (last push 2024-08) but stable; no official server (community FastAPI wrappers).
- **Verdict**: viable cheap fixed-voice tier; Kokoro (same lineage, better, permissive) supersedes it for most uses.

### 3.14 MeloTTS — https://github.com/myshell-ai/MeloTTS (7.6k ⭐)

- **What**: fast multilingual (en/es/fr/zh/ja/ko) VITS-style TTS, CPU-friendly, MIT.
- **Quality**: decent but flat prosody; not arena-ranked. **Cloning**: no.
- **Hardware**: CPU real-time; ~100 MB. **Maturity**: stable, stale (last push 2024-12).
- **Verdict**: okay fallback tier; Piper/Kokoro cover the same niche better.

### 3.15 Mimic 3 — https://github.com/MycroftAI/mimic3 (1.3k ⭐)

- **What**: Mycroft's local neural TTS (VITS, ONNX) with a GRPC server and voice pack catalog.
- **License**: **AGPL-3.0** ❌ (copyleft). **Quality**: dated. **Cloning**: no.
- **Verdict**: skip — AGPL plus low quality; Piper is the superior local engine.

### 3.16 OpenVoice V2 — https://github.com/myshell-ai/OpenVoice (37.1k ⭐)

- **What**: instant tone-color (voice) cloning + voice-style control; MIT from MIT/MyShell. **V2 weights are MIT** ✅ (verified HF card `myshell-ai/OpenVoiceV2`). V1 had NC-ish clauses; V2 is clean.
- **Quality**: AA **Elo 948** (as a full pipeline). **Cloning**: yes — instant, cross-lingual tone-color transfer.
- **Hardware**: small GPU or even CPU (~0.1 RTF); runs on top of a base TTS (e.g. MeloTTS/StyleTTS).
- **Maturity**: active-ish (last push 2025-04); Gradio demo, pip install, TTS-free usage; used inside many products as a conversion layer.
- **Verdict**: the cleanest commercial path to "voice conversion" — pair with Kokoro for a fully MIT stack.

### 3.17 Parler TTS — https://github.com/huggingface/parler-tts (5.6k ⭐)

- **What**: prompt-description TTS ("a female speaker with a sad tone…") trained by HF + LAION; mini (0.45B) and large (1.6B).
- **License**: **Apache-2.0** code; large v0.1 weights Apache-2.0 (mini Expresso is CC-BY-NC). ✅
- **Quality**: below premium; not arena-ranked. **Cloning**: no (descriptive control only).
- **Hardware**: large: ~3–6 GB VRAM; RTF ~1–2. **Maturity**: stable but stale (last push 2024-12).
- **Verdict**: interesting control UI; not a premium-quality tier.

### 3.18 SeamlessM4T v2 — https://github.com/facebookresearch/seamless_communication (11.8k ⭐)

- **What**: Meta's speech-to-speech/translation suite; TTS for ~100 languages; expressive variants.
- **License**: code MIT; **weights CC-BY-NC-4.0** ❌ (verified HF card `facebook/seamless-m4t-v2-large`).
- **Hardware**: 2.3B params, ~16 GB VRAM; slow. **Maturity**: stable but heavy.
- **Verdict**: skip for a premium English-centric SaaS; only relevant for exotic-language translation.

### 3.19 IndexTTS / IndexTTS2 — https://github.com/index-tts/index-tts (22.5k ⭐)

- **What**: Bilibili's industrial zero-shot TTS (F5-TTS-style architecture refined); IndexTTS2 (1B, 25 kHz) with emotion control, streaming, cross-lingual zh/en; IndexTTS2-hier for longer contexts.
- **License**: code MIT; **weights under the "bilibili Model Use License"** (custom, verified LICENSE file): commercial use **allowed** below thresholds (**<100M MAU/mo AND <RMB 1B annual revenue**) — a SaaS startup is fine; larger companies must request a separate license. Also: cannot use the model to improve other AI models; keep attribution; no high-risk uses. ⚠️ but workable.
- **Quality**: not arena-ranked; widely regarded as top-tier zero-shot (community + vendor evals ≈ CosyVoice2-class).
- **Hardware**: ~6–8 GB VRAM fp16; RTF ~0.1.
- **Maturity**: very active (380 open issues, pushed 2026-08); API server, Gradio, Docker; community vLLM runtime (`Ksuriuri/index-tts-vllm`, 1.2k ⭐) for production throughput.
- **Verdict**: strong candidate for commercial zero-shot cloning.

### 3.20 Zonos — https://github.com/Zyphra/Zonos (7.2k ⭐)

- **What**: Zyphra's open TTS (transformer + hybrid GAN vocoder, 1.6B), 200k+ hours training data; 9 languages; zero-shot cloning; accent/emotion/style control.
- **License**: **Apache-2.0** code AND weights ✅ (verified HF card `Zyphra/Zonos-v0.1-transformer`).
- **Quality**: AA **Elo 1000** — mid-pack but respectable.
- **Hardware**: ~10 GB VRAM bf16 (1.6B); RTF ~0.3–0.4 (not real-time streaming). Known long-form issues; repo stalled since 2025-03 (v0.1).
- **Maturity**: good docs, Python API; no official server (community wrappers). v0.1 = research-grade with rough edges.
- **Verdict**: viable Apache-2.0 zero-shot option when GPU headroom is available; watch for long-form quality.

### 3.21 Qwen3-TTS — https://github.com/QwenLM/Qwen3-TTS (12.9k ⭐)

- **What**: Alibaba Qwen's open TTS series (Jan 2026): **Qwen3-TTS-12Hz-0.6B / 1.7B** (+25Hz variants), discrete-codec LM architecture with a 12 Hz tokenizer. Features: 10 languages (zh/en/ja/ko/de/fr/ru/pt/es/it), **3-second voice cloning** (Base models), **voice design from text descriptions** (VoiceDesign), 9 premium timbres (CustomVoice), instruction-based emotion/pace control, and **streaming with ~97 ms first-packet latency**.
- **License**: **Apache-2.0** code AND weights ✅ (verified repo + HF collection).
- **Quality**: AA ranks API-served versions at 915–935; in-vendor eval (Seed-TTS WER) the 12Hz-1.7B-Base (0.77/1.24) is the **best open zero-shot model tested**, ahead of CosyVoice3 and MiniMax; speaker-similarity ≈0.81 (beats ElevenLabs in their multilingual test).
- **Hardware**: 0.6B ≈ 4 GB, 1.7B ≈ 8 GB VRAM bf16 (flash-attn recommended); streaming real-time. **vLLM-Omni day-0 support** for production serving (offline now, online serving coming).
- **Maturity**: very active (56 issues, pushed 2026-03); `qwen-tts` pip package, Gradio demo server, fine-tuning scripts, DashScope hosted API as a fallback.
- **Verdict**: **the strongest all-round choice** — Apache-2.0, cloning + design + streaming + vLLM serving, top open accuracy.

---

## 4. Commercial-use checklist (the critical part for a SaaS)

| Engine | Code license | Weights license | SaaS-compatible? |
|---|---|---|---|
| Kokoro-82M | Apache-2.0 | Apache-2.0 | ✅ Yes |
| Qwen3-TTS | Apache-2.0 | Apache-2.0 | ✅ Yes |
| CosyVoice 2/3 | Apache-2.0 | Apache-2.0 | ✅ Yes |
| Zonos | Apache-2.0 | Apache-2.0 | ✅ Yes |
| OpenVoice V2 | MIT | MIT | ✅ Yes |
| StyleTTS 2 / MeloTTS | MIT | MIT | ✅ Yes (fixed voices only) |
| IndexTTS2 | MIT | bilibili custom license | ⚠️ Yes if <100M MAU & <RMB 1B rev; no model-improvement use |
| Piper | MIT | per-voice (check!) | ⚠️ Depends on voice |
| GPT-SoVITS | MIT | official voices non-commercial | ⚠️ Train your own voices with licensed data |
| Fish Speech / OpenAudio | BSD-3 | CC-BY-NC-SA-4.0 | ❌ No — paid license from fish.audio needed |
| XTTS-v2 | MPL-2.0 | Coqui Public Model License | ❌ No (non-commercial) |
| F5-TTS / E2-TTS | MIT | CC-BY-NC-4.0 | ❌ No |
| Bark / SeamlessM4T | MIT | CC-BY-NC-4.0 | ❌ No |
| ChatTTS | AGPL-3.0 | CC BY-NC 4.0 | ❌ No |
| Mimic 3 | AGPL-3.0 | mixed | ❌ No |
| edge-tts | LGPL-3.0 | n/a (MS endpoint) | ⚠️ Legal grey zone (unofficial MS endpoint) |
| Tortoise | Apache-2.0 | Apache-2.0 (repo) | ✅ but unusably slow |

> Note: license facts above were verified against GitHub LICENSE files / HF model cards on 2026-08-10 (edge-tts LGPL-3.0, Kokoro Apache-2.0, XTTS-v2 CPML, CosyVoice2 Apache-2.0, fish-speech-1.5 CC-BY-NC-SA-4.0, OpenVoiceV2 MIT, seamless-m4t-v2 CC-BY-NC-4.0, Zonos Apache-2.0, F5-TTS CC-BY-NC, IndexTTS bilibili license, Qwen3-TTS Apache-2.0). **Licenses change — re-verify before shipping.**

---

## 5. Self-hosting vs edge-tts vs Typecast (the strategic question)

**If the goal is a "premium" tier:** neither edge-tts nor Typecast gets you there on your own terms.

- **edge-tts** = great free MVP voices, but: no cloning, no ownership, ToS grey zone for paid services, endpoint can vanish. Use only to bootstrap, and even then consider Azure Speech proper for anything you bill for.
- **Typecast** (SSFM-v21/v30 on speech.dev, AA-indexed) = a solid commercial API with Korean/English focus; fine as an initial hosted premium layer, but you pay per character, gain no model ownership, and its Elo (~940–950 region, mid-tier) is not clearly above what Kokoro/Qwen3-TTS deliver self-hosted.
- **Self-hosting** = upfront infra cost (GPU nodes) but: permissive licenses (Apache-2.0 stack), per-request cost near zero (Kokoro ≈ $0.65/1M chars even when *sold* by others), full data control, voice cloning as a product feature, and streaming latency that beats most hosted APIs.

**Recommended architecture (tiered):**

1. **Tier 1 — Workhorse (CPU): Kokoro-82M.** Apache-2.0, Elo 1056, 54 voices, real-time on plain CPU boxes → near-zero marginal cost for high volume. This is the "premium-feeling" default voice layer for a fraction of a cent per generation.
2. **Tier 2 — Premium zero-shot + streaming (GPU): Qwen3-TTS-12Hz-1.7B** (Apache-2.0; 3-s cloning, voice design, 97 ms streaming, vLLM-Omni serving) — the flagship "AI voice cloning" feature.
3. **Tier 2b — Alternative/backup GPU: CosyVoice3** (Apache-2.0, streaming, cross-lingual) or **IndexTTS2** (bilibili license OK for a startup; top zero-shot similarity).
4. **Tier 3 — Customer voice fine-tuning: GPT-SoVITS** (MIT) with your own licensed training data for high-fidelity per-customer voices.
5. **Voice conversion add-on: OpenVoice V2** (MIT) for instant tone-color transfer without retraining.
6. **Fallback/resilience: Azure Speech or Typecast API** for languages/voices the open stack lacks — not as the foundation, as insurance.

**Avoid for a paid product:** XTTS-v2 (CPML), F5/E2 (CC-BY-NC), Fish Speech weights (NC), ChatTTS (AGPL+NC), Bark/Seamless (NC), edge-tts in production.

---

## 6. Bottom line

- **Best open quality with clean commercial license:** Qwen3-TTS (Apache-2.0) and CosyVoice3 (Apache-2.0) for cloning/streaming; Kokoro (Apache-2.0) for volume; Fish/OpenAudio if you buy a license.
- **Self-hosting is clearly viable** — the Apache/MIT stack above covers fixed voices, zero-shot cloning, streaming, and fine-tuning with full commercial rights, and open weights now rank in the top quarter of the TTS arena (Kokoro 1056, S2 Pro 1121 vs 1229 SOTA).
- **edge-tts is an MVP shortcut, not a foundation.** **Typecast is a good hosted accelerator, not a moat.** A self-hosted layer using Kokoro + Qwen3-TTS/CosyVoice3 gives you a defensible, licensed, low-cost premium tier — and voice cloning as the differentiator.

---

## 7. Sources

- GitHub repos & star counts: api.github.com (all repos above), retrieved 2026-08-10.
- Licenses: LICENSE files / HF model cards: edge-tts (LGPL-3.0), Kokoro-82M (apache-2.0), XTTS-v2 (coqui-public-model-license), CosyVoice2-0.5B (apache-2.0), fish-speech-1.5 (cc-by-nc-sa-4.0), OpenVoiceV2 (mit), seamless-m4t-v2-large (cc-by-nc-4.0), Zonos-v0.1-transformer (apache-2.0), IndexTTS (bilibili Model Use License), F5-TTS README (CC-BY-NC weights), Qwen3-TTS repo (Apache-2.0).
- Quality: https://artificialanalysis.ai/text-to-speech/arena (Speech Arena leaderboard, 2026-08-10); https://www.speech.dev/models?type=TTS (2026-08-10); TTS-Spaces-Arena (HF); Qwen3-TTS technical report (arXiv 2601.15621, incl. Seed-TTS WER + InstructTTSEval).
- Hardware/latency: F5-TTS README (L20 Triton/TRT-LLM benchmark), Qwen3-TTS README (97 ms streaming), Kokoro model card (training cost, size), CosyVoice/GPT-SoVITS/Fish Speech READMEs.
