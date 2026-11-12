import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/app-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[minmax(380px,5fr)_7fr]">
      <div className="flex flex-col justify-between bg-nav px-12 py-10 text-nav-text">
        <div className="flex items-center gap-2.5"><BrandMark size={30} /><span className="text-lg font-semibold tracking-tight text-white">WorkDesk</span></div>
        <div className="max-w-sm">
          <h2 className="text-[26px] font-semibold leading-tight text-white">Internal service requests, handled in one place.</h2>
          <ul className="mt-6 space-y-3 text-sm leading-6">
            <li className="border-l-2 border-brand-500 pl-3">Raise a request to any department and follow it from review to resolution.</li>
            <li className="border-l-2 border-brand-500 pl-3">Managers review, clarify and assign. Agents record progress and resolutions.</li>
            <li className="border-l-2 border-brand-500 pl-3">Access follows roles and permissions that administrators manage without code changes.</li>
          </ul>
        </div>
        <p className="text-xs text-[#6F7E94]">Authorised use only. Activity on this system is recorded.</p>
      </div>
      <div className="flex items-center justify-center bg-panel px-10 py-12">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </div>
  );
}
