"use client";

import { useState } from "react";
import { INTEGRATION_REQUEST_EMAIL } from "@/lib/marketing";
import { INTEGRATION_REQUEST_API_PATH } from "@/lib/public-path";
import { apiPath } from "@/lib/utils";

type Status = { tone: "ok" | "err"; text: string } | null;

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm text-[#1d1d1f] outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20";

export default function IntegrationRequestForm() {
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const integration = String(data.get("integration") || "").trim();
    const useCase = String(data.get("useCase") || "").trim();
    const companyWebsite = String(data.get("companyWebsite") || "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({ tone: "err", text: "Enter an email so we can reply." });
      return;
    }
    if (integration.length < 2) {
      setStatus({ tone: "err", text: "Enter the integration you want." });
      return;
    }
    if (useCase.length < 10) {
      setStatus({ tone: "err", text: "Say briefly why you need it (at least a short sentence)." });
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(apiPath(INTEGRATION_REQUEST_API_PATH), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, integration, useCase, companyWebsite }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        setStatus({
          tone: "err",
          text: payload?.error || `We couldn't send that request. Email ${INTEGRATION_REQUEST_EMAIL} and we'll take it from there.`,
        });
        return;
      }
      form.reset();
      setStatus({ tone: "ok", text: "Request sent. We'll reply at the email you gave us." });
    } catch {
      setStatus({
        tone: "err",
        text: `We couldn't send that request. Email ${INTEGRATION_REQUEST_EMAIL} and we'll take it from there.`,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative rounded-3xl glass-card p-6 sm:p-8" noValidate>
      <h2 className="text-xl font-semibold text-[#1d1d1f]">Request an integration</h2>
      <p className="mt-2 text-sm text-[#6e6e73] leading-relaxed">
        Name the tool and what you need it to do. Email is required so we can reply.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-[#1d1d1f]">
          Name <span className="font-normal text-[#86868b]">(optional)</span>
          <input name="name" type="text" autoComplete="name" maxLength={80} className={fieldClass} />
        </label>
        <label className="block text-sm font-medium text-[#1d1d1f]">
          Email
          <input name="email" type="email" required autoComplete="email" maxLength={254} className={fieldClass} />
        </label>
      </div>
      <label className="mt-4 block text-sm font-medium text-[#1d1d1f]">
        Integration
        <input name="integration" type="text" required maxLength={80} className={fieldClass} placeholder="The tool you want connected" />
      </label>
      <label className="mt-4 block text-sm font-medium text-[#1d1d1f]">
        Why you need it
        <textarea name="useCase" required minLength={10} maxLength={1500} rows={4} className={fieldClass} placeholder="What should it bring in or send out?" />
      </label>
      <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        <label>
          Company website
          <input name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-[#007AFF] hover:bg-[#0071E3] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
        >
          {pending ? "Sending…" : "Request integration"}
        </button>
        {status && (
          <p role="status" className={`text-sm ${status.tone === "ok" ? "text-[#248A3D]" : "text-[#C45500]"}`}>
            {status.text}
          </p>
        )}
      </div>
    </form>
  );
}
