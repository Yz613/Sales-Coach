"use client";

import IntegrationRequestForm from "@/components/IntegrationRequestForm";
import MarketingShell from "@/components/MarketingShell";
import { publicIntegrationGroups, PUBLIC_INTEGRATION_COUNT } from "@/lib/publicIntegrations";

const groups = publicIntegrationGroups();

export default function IntegrationsMarketing() {
  return (
    <MarketingShell current="integrations">
      <main>
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-20">
          <p className="text-[17px] font-medium text-[#007AFF]">Integrations</p>
          <h1 className="mt-3 max-w-3xl text-[40px] sm:text-[56px] font-semibold tracking-[-0.03em] text-[#1d1d1f] leading-[1.05]">
            Connect the tools your team already uses.
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] sm:text-[19px] text-[#6e6e73] leading-snug">
            {PUBLIC_INTEGRATION_COUNT} connectors are in the product today. Calls, CRM records, calendars, tasks, chat alerts, and automation. If yours is missing, request it.
          </p>
          <a href="#request" className="mt-6 inline-flex text-sm font-semibold text-[#0071E3] hover:text-[#0077ED]">
            Request an integration
          </a>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
          {groups.map((group) => (
            <div key={group.category}>
              <h2 className="text-[13px] font-medium text-[#007AFF]">{group.category}</h2>
              <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.items.map((item) => (
                  <li key={item.id} className="rounded-3xl glass-card p-5 flex gap-4">
                    <img
                      src={item.logoSrc}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-xl border border-black/[0.06] bg-white object-contain p-1.5"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#1d1d1f]">{item.name}</h3>
                        <span className="rounded-full bg-emerald-500/10 text-[#248A3D] border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold">
                          Available
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-[#6e6e73] leading-relaxed">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section id="request" className="scroll-mt-24 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="max-w-2xl">
            <IntegrationRequestForm />
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
