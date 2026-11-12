"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Alert, Button } from "@/components/ui";

/** One-time secret (generated password). Shown once, with a copy button and a clear warning. */
export function SecretReveal({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded border border-line-strong bg-canvas px-3 py-2">
        <code className="flex-1 select-all break-all text-sm">{value}</code>
        <Button size="sm" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}>
          {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
        </Button>
      </div>
      <Alert tone="warn">This is the only time the password is shown. It cannot be retrieved later.</Alert>
    </div>
  );
}
