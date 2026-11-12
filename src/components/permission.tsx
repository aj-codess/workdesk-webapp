"use client";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LinkButton, Spinner } from "@/components/ui";

/** Render children only when the user holds at least one of the permissions. UI convenience only: the API enforces the same rule. */
export function Can({ any, children, fallback = null }: { any: string | string[]; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useAuth();
  const keys = Array.isArray(any) ? any : [any];
  return <>{can(...keys) ? children : fallback}</>;
}

export function Forbidden({ title = "You do not have access to this page" }: { title?: string }) {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warn-bg text-warn-fg"><ShieldAlert className="h-6 w-6" /></div>
      <h1 className="text-xl">{title}</h1>
      <p className="mt-2 text-sm text-ink-3">Your account does not hold the permission this page needs. If you think this is a mistake, ask a system administrator to review your roles.</p>
      <div className="mt-5"><LinkButton href="/dashboard" variant="primary">Back to dashboard</LinkButton></div>
    </div>
  );
}

/** Page-level guard. The route renders only for users holding one of `any`. */
export function RequirePermission({ any, children }: { any: string | string[]; children: ReactNode }) {
  const { can, status } = useAuth();
  const keys = Array.isArray(any) ? any : [any];
  if (status === "loading") return <div className="flex justify-center py-20"><Spinner /></div>;
  return can(...keys) ? <>{children}</> : <Forbidden />;
}
