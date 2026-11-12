# WorkDesk Web

The web client for the WorkDesk API. Next.js 15 (App Router) with TypeScript, as the assignment specifies, plus Tailwind CSS, TanStack Query, React Hook Form and Zod.

## Run it

Requirements: Node 20.9+ and the WorkDesk API running (default `http://localhost:4000`).

```bash
npm install
cp .env.example .env          # set API_ORIGIN if the API is not on localhost:4000
npm run dev                   # http://localhost:3000
```

Production build:

```bash
API_ORIGIN=https://api.internal.example npm run build
npm run start
```

**`API_ORIGIN` is read when you build.** Next.js bakes the `/api/*` proxy rule into the build, so changing it later needs a rebuild.

### Backend settings that must match

The browser only talks to this app. `/api/*` is proxied to the API, so the refresh cookie (HttpOnly, `SameSite=Strict`, path `/api/auth`) is first-party and no CORS is involved. In the backend `.env`:

| Variable | Value |
|---|---|
| `FRONTEND_URL` | `http://localhost:3000` (the origin users open; also used in reset-password links) |
| `CORS_ORIGINS` | `http://localhost:3000` (the API checks `Origin` on `/auth/refresh`) |
| `TRUST_PROXY` | `true` in production, so rate limits see real client addresses forwarded by this app |
| `COOKIE_SECURE` | `false` for local http, `true` in production (https) |

Seed demo users with `SEED_DEMO=true npm run prisma:seed` in the backend. Sign in as `admin@workdesk.local`, `manager.it@workdesk.local`, `agent.it@workdesk.local`, `employee@workdesk.local` or `auditor@workdesk.local` (demo password `Workdesk#Demo1`).

## How it works

**Authentication.** The access token (15 min) lives in memory only. On every page load the app calls `POST /api/auth/refresh` (the cookie rotates) and then `GET /api/auth/me`, which is how a signed-in user survives a reload. The token is renewed a minute before expiry, and any request that fails with `TOKEN_EXPIRED` refreshes once and retries. Concurrent refreshes share one request because refresh tokens are single use. A revoked session (deactivated user, password change, logout elsewhere) sends the user back to sign-in with a message. Accounts flagged `mustChangePassword` are held on the password screen until they choose a new one.

**Permissions.** `src/lib/auth.tsx` exposes `can(...keys)` (true if the user holds at least one). It drives the sidebar (`src/lib/permissions.ts`), page guards (`<RequirePermission>`), buttons (`<Can>`), and filters. Nothing compares role names. Effective permissions are re-read when the tab regains focus and after any 403, so a role change shows up without signing out. Ticket buttons come from the server-computed `allowedActions`. This is presentation only: every action is re-checked by the API.

**Errors.** 400 field errors from the API are placed on the matching form fields. 401, 403, 404, 409 and 429 get specific wording (for example last-administrator protection and escalation blocks). Out-of-scope records show "not found", matching the API's 404 rule.

## Structure

```
src/app/(auth)/      login, forgot-password, reset-password
src/app/(app)/       dashboard, tickets (list, new, detail), departments, users, roles,
                     reports, audit-logs, settings, profile  (protected layout)
src/components/ui/   buttons, fields, modal, toast, tables helpers, tabs, pagination
src/components/      shell/sidebar, permission guards, ticket workflow dialogs, thread, attachments
src/lib/             api client, auth provider, permissions map, types, formatting
```

## Screens

| Area | What it does |
|---|---|
| Dashboard | Widgets per permission: my requests, my work, department queue and workload, system overview |
| Requests | Filter (status, priority, department, search), saved in the URL; scope tabs; review and unassigned shortcuts; pagination |
| Request detail | Conversation with internal work notes, activity timeline, assignment history, attachments, and every workflow action (accept, reject, clarify, assign/reassign, start, resolve, close, reopen, cancel, transfer, priority, edit, delete) |
| Departments | Managers, members, categories |
| Users | Create, edit, assign several roles, activate/deactivate, reset password, sessions, delete |
| Roles and permissions | Create roles, permission matrix by module with a diff before saving, holders, delete |
| Reports | Summary, grouping, team performance, CSV export |
| Audit log | Filters, expandable before/after |
| Settings | Whitelisted system settings with range hints |
| Profile | Details, change password, active sessions |

## Checks

`npm run typecheck` and `npm run build` pass. The UI was exercised in Chromium against a built API with PostgreSQL: sign-in, session survival on reload, the full request lifecycle as employee, manager, agent and employee again (internal notes never shown to the requester), role creation with a permission change, user creation with a role, and forbidden pages for users lacking permissions.
