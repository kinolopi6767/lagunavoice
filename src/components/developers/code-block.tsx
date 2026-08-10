"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CodeBlock({ code, label }: { code: string; label?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      window.prompt("Copy manually:", code);
    }
  }

  return (
    <div className="relative">
      {label ? (
        <div className="absolute right-2 top-2">
          <Button size="xs" variant="secondary" onClick={copy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      ) : null}
      <pre className="overflow-x-auto rounded-lg border bg-muted/60 p-4 pt-3 font-mono text-xs leading-5">
        <code>{code}</code>
      </pre>
      {!label ? (
        <div className="mt-2">
          <Button size="xs" variant="outline" onClick={copy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}