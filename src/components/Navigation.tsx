"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Users, PhoneCall, PlusCircle, BarChart3, BookOpen, Settings, LogIn, GraduationCap } from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import UploadModal from "./UploadModal";

export default function Navigation() {
  const pathname = usePathname();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const navItems = [
    { label: "Super Admin", href: "/", icon: ShieldAlert },
    { label: "Executive Analytics", href: "/admin/analytics", icon: BarChart3 },
    { label: "Prescribed Scripts", href: "/admin/scripts", icon: BookOpen },
    { label: "Coach", href: "/coach", icon: GraduationCap },
    { label: "Rep Progression", href: "/reps", icon: Users },
    { label: "Call Bank", href: "/calls", icon: PhoneCall },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <div className="flex items-center gap-6">
            {/* Brand Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20">
                SC
              </div>
              <div>
                <span className="font-bold text-white tracking-tight text-base">SALES COACH</span>
                <span className="block text-[10px] uppercase font-semibold text-blue-400 tracking-wider">AI Sales Manager</span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                      isActive
                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
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

          {/* Right Actions: Settings & Upload */}
          <div className="flex items-center gap-3">
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
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-blue-500 transition active:scale-[0.98]"
            >
              <PlusCircle className="h-4 w-4" />
              Upload Calls
            </button>

            <Show
              when="signed-in"
              fallback={
                <SignInButton mode="redirect">
                  <button className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition">
                    <LogIn className="h-3.5 w-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Sign In</span>
                  </button>
                </SignInButton>
              }
            >
              <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            </Show>
          </div>
        </div>
      </header>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />
    </>
  );
}
