import { LinkButton } from "@/components/ui";
export default function NotFound() {
  return (
    <div className="mx-auto mt-32 max-w-sm text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-1 text-xl">Page not found</h1>
      <p className="mt-2 text-sm text-ink-3">The page does not exist, or you cannot see it.</p>
      <div className="mt-5"><LinkButton href="/dashboard" variant="primary">Go to dashboard</LinkButton></div>
    </div>
  );
}
