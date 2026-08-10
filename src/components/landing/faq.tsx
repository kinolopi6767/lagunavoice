const FAQ = [
  {
    q: "Is the audio mine to use commercially?",
    a: "Yes. You own the audio you generate. Premium and flagship voices are fully licensed for commercial use on paid plans. Free Edge TTS voices are for personal use and content creation.",
  },
  {
    q: "Do credits expire?",
    a: "No. Purchased credits never expire. Monthly plan allowances roll over for 90 days so you never lose what you paid for.",
  },
  {
    q: "Which engines power the voices?",
    a: "We're transparent about it: free voices use Microsoft Edge TTS, premium voices use Typecast's models, and flagship voices use Deepgram Aura-2. You see the engine on every voice.",
  },
  {
    q: "Can I clone my own voice?",
    a: "Yes — from a 5–150 second recording. We require you to confirm you own the rights to the voice, and cloned voices are private to your account.",
  },
  {
    q: "Is there an API for developers?",
    a: "Yes. A REST API with idempotent billing, streaming WebSocket, voice cloning and JS/Python SDKs. Create API keys from your dashboard.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-3xl font-bold tracking-tight">Questions, answered</h2>
      <div className="mt-8 space-y-3">
        {FAQ.map((item) => (
          <details key={item.q} className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">{item.q}</summary>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
