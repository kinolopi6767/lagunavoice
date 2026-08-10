import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try the studio",
    features: ["2,000 signup credits", "Unlimited Edge TTS voices", "100K free chars/day", "10K chars per generation"],
    cta: "Start free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Creator",
    price: "$10",
    period: "/month",
    description: "For growing channels",
    features: ["25,000 premium credits/mo", "5,000 flagship credits/mo", "Long-form up to 100K chars", "SRT subtitles", "90-day credit rollover"],
    cta: "Choose Creator",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$20",
    period: "/month",
    description: "For pros & teams",
    features: ["50,000 premium credits/mo", "15,000 flagship credits/mo", "Long-form up to 500K chars", "Voice cloning (grant)", "Priority concurrency"],
    cta: "Choose Pro",
    href: "/signup",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-3xl font-bold tracking-tight">Simple, honest pricing</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
        1 credit = 1 character of premium voice. Flagship voices cost 2 credits.
        Free voices cost nothing. Credits never expire.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.name} className={p.highlighted ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.description}</CardDescription>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-primary">✓</span> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant={p.highlighted ? "default" : "outline"} asChild>
                <a href={p.href}>{p.cta}</a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need more? Custom packs and enterprise plans via{" "}
        <a href="mailto:hello@lugunavoice.com" className="underline underline-offset-4">contact</a>.
      </p>
    </section>
  );
}
