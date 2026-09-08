"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Users, PhoneCall, PlusCircle, BarChart3, BookOpen, Settings } from "lucide-react";
import UploadModal from "./UploadModal";
import BrandMark from "./BrandMark";

export default function Navigation() {
  const pathname = usePathname();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const navItems = [
    { label: "Super Admin", href: "/dashboard", icon: ShieldAlert },
    { label: "Executive Analytics", href: "/admin/analytics", icon: BarChart3 },
    { label: "Prescribed Scripts", href: "/admin/scripts", icon: BookOpen },
    { label: "Rep Progression", href: "/reps", icon: Users },
    { label: "Call Bank", href: "/calls", icon: PhoneCall },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <BrandMark href="/dashboard" tone="ink" />

            <nav className="hidden items-center space-x-1 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                      isActive
                        ? "border border-slate-700 bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-900 hover:text-white sm:inline-flex"
            >
              Marketing site
            </Link>
            <Link
              href="/admin/settings"
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-300 transition ${
                pathname === "/admin/settings"
                  ? "border-blue-500 bg-blue-500/10 text-white"
                  : "border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white"
              }`}
              title="Admin Settings & API Key"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow transition hover:bg-blue-500 active:scale-[0.98]"
            >
              <PlusCircle className="h-4 w-4" />
              Upload Calls
            </button>
          </div>
        </div>
      </header>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </>
  );
}
