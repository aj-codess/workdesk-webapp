"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { post } from "@/lib/api";
import { Alert, Button, errorText, Field, Input } from "@/components/ui";

const schema = z.object({ email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address") });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try { await post("/api/auth/forgot-password", v); setSent(v.email); } catch (e) { setError(errorText(e)); }
  });

  if (sent) {
    return (
      <>
        <h1 className="text-2xl">Check your email</h1>
        <Alert tone="ok" className="mt-5">If an account exists for <strong>{sent}</strong>, a reset link has been sent. The link works once and expires in 30 minutes.</Alert>
        <p className="mt-5 text-sm"><Link href="/login">Back to sign in</Link></p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-3">Enter your work email and we will send a reset link.</p>
      {error && <Alert tone="bad" className="mt-5">{error}</Alert>}
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" error={form.formState.errors.email?.message} htmlFor="email">
          <Input id="email" type="email" autoComplete="username" autoFocus invalid={!!form.formState.errors.email} {...form.register("email")} />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>Send reset link</Button>
      </form>
      <p className="mt-5 text-sm"><Link href="/login">Back to sign in</Link></p>
    </>
  );
}
