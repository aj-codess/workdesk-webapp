"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { post } from "@/lib/api";
import { Alert, Button, errorText, Field, Input } from "@/components/ui";
import { PASSWORD_HELP, PASSWORD_RULE } from "@/lib/forms";

const schema = z.object({
  newPassword: z.string().regex(PASSWORD_RULE, PASSWORD_HELP),
  confirm: z.string(),
}).refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "The passwords do not match" });

function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { newPassword: "", confirm: "" } });

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return (
      <>
        <h1 className="text-2xl">Reset link not valid</h1>
        <Alert tone="bad" className="mt-5">This link is incomplete. Request a new one and use the link from the latest email.</Alert>
        <p className="mt-5 text-sm"><Link href="/forgot-password">Request a new link</Link></p>
      </>
    );
  }
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try { await post("/api/auth/reset-password", { token, newPassword: v.newPassword }); router.replace("/login?reset=1"); }
    catch (e) { setError(errorText(e).includes("Invalid or expired") ? "This link is invalid, has expired or was already used. Request a new one." : errorText(e)); }
  });
  return (
    <>
      <h1 className="text-2xl">Choose a new password</h1>
      <p className="mt-1 text-sm text-ink-3">You will be signed out everywhere and asked to sign in again.</p>
      {error && <Alert tone="bad" className="mt-5">{error} <Link href="/forgot-password">Request a new link</Link></Alert>}
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="New password" hint={PASSWORD_HELP} error={form.formState.errors.newPassword?.message} htmlFor="np">
          <Input id="np" type="password" autoComplete="new-password" autoFocus invalid={!!form.formState.errors.newPassword} {...form.register("newPassword")} />
        </Field>
        <Field label="Confirm new password" error={form.formState.errors.confirm?.message} htmlFor="cp">
          <Input id="cp" type="password" autoComplete="new-password" invalid={!!form.formState.errors.confirm} {...form.register("confirm")} />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>Set password</Button>
      </form>
    </>
  );
}
export default function ResetPasswordPage() { return <Suspense><ResetForm /></Suspense>; }
