import type { Metadata } from "next";
import MarketingShell from "@/components/MarketingShell";
import { CONTACT_EMAIL } from "@/lib/marketing";
import { IPINFO_ATTRIBUTION, IPINFO_ATTRIBUTION_URL } from "visitor-company";

export const metadata: Metadata = {
  metadataBase: new URL("https://refreshqueue.com"),
  title: "Privacy policy — Refresh Queue",
  description: "How Refresh Queue handles visits to refreshqueue.com and customer data in Sales Coach.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <MarketingShell current="privacy">
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">Privacy policy</h1>
        <p className="mt-3 text-sm text-[#6e6e73]">
          Effective <time dateTime="2026-10-06">October 6, 2026</time>.
        </p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-[#3a3a3c]">
          <p>
            This covers the public site at refreshqueue.com, run by Refresh Queue. Sales Coach is the product on that site.
          </p>
          <p>We do not sell personal data.</p>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">When you visit</h2>
            <p>
              We record page views, clicks, and form submissions through our analytics. Text you type into inputs is masked, so those events do not include what you typed.
            </p>
            <p>
              Google Analytics and PostHog process those events for us. They are subprocessors.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">Company identification</h2>
            <p>
              If you are outside the EU, UK, and EEA, we use the IP address to infer the company network you are on. We do not store the IP address. This does not identify a person.
            </p>
            <p>
              If you are in the EU, UK, or EEA, we keep the country only. We do not look up a company for that visit.
            </p>
            <p>
              We honor Do Not Track and Global Privacy Control. If your browser sends either signal, we do not use the IP address to infer a company.
            </p>
            <p>
              <a href={IPINFO_ATTRIBUTION_URL} className="font-medium text-[#0071E3] hover:text-[#0077ED]">
                {IPINFO_ATTRIBUTION}
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">Emails you send</h2>
            <p>
              If you submit an integration request or join the waitlist, we use that email to reply to you.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">Returning Visitor Communications</h2>
            <p>
              Returning visitors who submitted an integration request or created an account may get a follow-up email from Yehuda.
            </p>
            <p>
              Each of those emails has a one-click unsubscribe. You get at most one of these emails every 7 days. Paying customers are excluded.
            </p>
            <p>
              We do not email people who never gave us their address.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">We never train on your data</h2>
            <p>
              Customer content is never used to train models, by us or by the model providers we use. That includes call recordings, transcripts, scorecards, and coaching notes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">Data in the app</h2>
            <p>
              Call recordings and other customer data stored in Sales Coach are covered by the customer agreement and by the retention settings in the app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">Contact</h2>
            <p>
              Questions:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-[#0071E3] hover:text-[#0077ED]">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}
