import type { Metadata } from "next";
import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "LugunaVoice — AI voice studio | Free, premium & flagship TTS voices",
  description:
    "Turn text into studio-quality voiceovers. 1,100+ voices, 30+ languages, long-form narration, voice cloning, SRT subtitles and a developer API. Try it free — no account needed.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "LugunaVoice — AI voice studio",
    description:
      "Free, premium and flagship AI voices. Long-form narration, voice cloning, subtitles and a developer API.",
    type: "website",
    url: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LugunaVoice",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description:
    "AI voice studio: text-to-speech with free, premium and flagship voices, long-form narration, voice cloning, subtitles and a developer API.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav />
      <main className="flex-1">
        <Hero />
        <Features />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
