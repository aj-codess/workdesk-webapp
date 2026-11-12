"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Alert, Button, errorText, Field, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/forms";

const schema = z.object({ email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"), password: z.string().min(1, "Enter your password") });
type Values = z.infer<typeof schema>;

function LoginForm() {
  const { login, status, endedReason, clearEndedReason } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const next = sp.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  useEffect(() => { if (status === "authenticated") router.replace(safeNext); }, [status, router, safeNext]);

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await login(v.email, v.password);
      router.replace(r.user.mustChangePassword ? "/profile?tab=security&must=1" : safeNext);
    } catch (e) {
      if (applyServerErrors(form, e)) return;
      setError(e instanceof ApiError && e.code === "INVALID_CREDENTIALS" ? "The email or password is incorrect, or the account is not available." : errorText(e));
      form.setValue("password", "");
    }
  });

  return (
    <>
      <h1 className="text-2xl">Sign in</h1>
      <p className="mt-1 text-sm text-ink-3">Use your work account to continue.</p>
      {sp.get("reset") === "1" && <Alert tone="ok" className="mt-5">Your password was changed. Sign in with the new password.</Alert>}
      {sp.get("changed") === "1" && <Alert tone="ok" className="mt-5">Password updated. Please sign in again.</Alert>}
      {endedReason && <Alert tone="warn" className="mt-5">{endedReason}</Alert>}
      {error && <Alert tone="bad" className="mt-5">{error}</Alert>}
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4" onChange={() => { if (endedReason) clearEndedReason(); }}>
        <Field label="Email" error={form.formState.errors.email?.message} htmlFor="email">
          <Input id="email" type="email" autoComplete="username" autoFocus invalid={!!form.formState.errors.email} {...form.register("email")} />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" invalid={!!form.formState.errors.password} {...form.register("password")} />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>Sign in</Button>
      </form>
      <p className="mt-5 text-sm"><Link href="/forgot-password">Forgot your password?</Link></p>
    </>
  );
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
