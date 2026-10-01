"use client";

import { useEffect, useState } from "react";
import { checkoutFailureMessage } from "@/lib/checkoutFailure";
import { CONTACT_MAILTO } from "@/lib/marketing";

export default function CheckoutNotice() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setMessage(checkoutFailureMessage(new URLSearchParams(window.location.search).get("checkout_error")));
  }, []);
  if (!message) return null;
  return (
    <div role="alert" className="mt-6 mx-auto max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p>{message}</p>
      <a href={CONTACT_MAILTO} className="mt-2 inline-block font-semibold underline">Contact us</a>
    </div>
  );
}
