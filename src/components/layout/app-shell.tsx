"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { BarChart3, Building2, ChevronDown, Inbox, KeyRound, LayoutDashboard, LogOut, ScrollText, Shield, SlidersHorizontal, UserCircle, Users, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { hasAny, NAV, P } from "@/lib/permissions";
import { Avatar, LinkButton, Menu, Spinner } from "@/components/ui";
import { fullName } from "@/lib/format";

const ICONS = { layout: LayoutDashboard, inbox: Inbox, chart: BarChart3, scroll: ScrollText, building: Building2, users: Users, shield: Shield, sliders: SlidersHorizontal };

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#2B6E9E" />
      <path d="M8 11.5h16M8 16h16M8 20.5h9.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Sidebar() {
  const { permissions, user } = useAuth();
  const path = usePathname();
  const visible = NAV.filter((n) => hasAny(permissions, n.any));
  const groups = ["Work", "Insight", "Administration"] as const;
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[232px] flex-col bg-nav text-nav-text">
      <div className="flex h-14 items-center gap-2.5 border-b border-nav-line px-4">
        <BrandMark />
        <span className="text-[15px] font-semibold tracking-tight text-white">WorkDesk</span>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-2.5 py-3" aria-label="Main">
        {groups.map((g) => {
          const items = visible.filter((n) => n.group === g);
          if (!items.length) return null;
          return (
            <div key={g} className="mb-4">
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#6F7E94]">{g}</p>
              {items.map((n) => {
                const Icon = ICONS[n.icon as keyof typeof ICONS];
                const active = path === n.href || path.startsWith(n.href + "/");
                return (
                  <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                    className={clsx("mb-0.5 flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm no-underline transition-colors",
                      active ? "bg-nav-active font-medium text-white" : "text-nav-text hover:bg-nav-hover hover:text-white")}>
                    <Icon className="h-4 w-4 shrink-0 opacity-90" />{n.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-nav-line px-4 py-3 text-xs">
        <p className="truncate text-[#C5CFDD]">{user?.department?.name ?? "No department"}</p>
        <p className="truncate text-[#6F7E94]">{user?.roles.map((r) => r.name).join(", ") || "No roles"}</p>
      </div>
    </aside>
  );
}

function Topbar() {
  const { user, logout, can } = useAuth();
  const router = useRouter();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-panel/95 px-8 backdrop-blur">
      <div />
      <div className="flex items-center gap-3">
        {can(P.tCreate) && path !== "/tickets/new" && <LinkButton href="/tickets/new" variant="primary"><Plus className="h-4 w-4" />New request</LinkButton>}
        <Menu trigger={
          <button className="flex items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-canvas" aria-haspopup="menu">
            <Avatar user={user} size={28} />
            <span className="hidden text-sm font-medium text-ink md:block">{fullName(user)}</span>
            <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
          </button>}>
          {(close) => (
            <>
              <div className="border-b border-line px-3 py-2">
                <p className="text-sm font-medium">{fullName(user)}</p>
                <p className="text-xs text-ink-3">{user?.email}</p>
              </div>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas" onClick={() => { close(); router.push("/profile"); }}><UserCircle className="h-4 w-4 text-ink-3" />My profile</button>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas" onClick={() => { close(); router.push("/profile?tab=security"); }}><KeyRound className="h-4 w-4 text-ink-3" />Password and sessions</button>
              <button className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm text-bad-fg hover:bg-bad-bg" onClick={() => { close(); void logout(); }}><LogOut className="h-4 w-4" />Sign out</button>
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}

/** Protected layout: renders the shell only for a signed-in user; everyone else goes to /login. */
export function AppShell({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login${path && path !== "/dashboard" ? `?next=${encodeURIComponent(path)}` : ""}`);
  }, [status, router, path]);

  // First-login / admin-reset accounts must choose a new password before anything else.
  useEffect(() => {
    if (status === "authenticated" && user?.mustChangePassword && path !== "/profile") router.replace("/profile?tab=security&must=1");
  }, [status, user?.mustChangePassword, path, router]);

  if (status !== "authenticated") {
    return <div className="flex h-screen items-center justify-center"><Spinner className="h-5 w-5" /></div>;
  }
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-[232px]">
        <Topbar />
        <main className="mx-auto max-w-[1280px] px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
