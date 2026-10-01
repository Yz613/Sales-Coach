"use client";
import type { ReactNode } from "react";
import { apiPath } from "@/lib/utils";
export const fieldClass = "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30";
export const buttonClass = "rounded-lg bg-[#007AFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#0071E3] disabled:opacity-50";
export const secondaryClass = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-medium text-[#007AFF] hover:bg-blue-50 disabled:opacity-50";
export function Card({ title, children }: { title?: string; children: ReactNode }) { return <section className="rounded-xl border border-black/[.08] bg-white p-5 sm:p-6 space-y-4">{title && <h2 className="font-semibold text-[#1d1d1f]">{title}</h2>}{children}</section>; }
export function Notice({ error, message }: { error?: string; message?: string }) { return error || message ? <div role={error ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-blue-100 bg-blue-50 text-blue-800"}`}>{error || message}</div> : null; }
export async function request(path: string, body?: unknown, method = "POST") {
  const response = await fetch(apiPath(path), { method: body === undefined ? "GET" : method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed."); return data;
}
