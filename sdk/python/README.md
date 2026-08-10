# lugunavoice (Python SDK)

```bash
pip install lugunavoice
```

```python
from lugunavoice import LugunaVoice

client = LugunaVoice("lug_...")  # create a key in the dashboard

voices = client.list_voices(tier="free", limit=5)
gen = client.generate_and_wait("Hello from LugunaVoice!", voice=voices["voices"][0]["id"], style="cheerful")

audio = client.audio_bytes(gen)  # bytes of the MP3
with open("output.mp3", "wb") as f:
    f.write(audio)
```

Errors raise `LugunaVoiceError` with `.code` and `.status`.
