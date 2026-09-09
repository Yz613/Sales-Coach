"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  Plus,
  BarChart3,
  BookOpen,
  Settings,
  Menu,
  X,
  GraduationCap,
  UserPlus,
} from "lucide-react";
import { useAppAuth } from "@/lib/auth-context";
import UploadModal from "./UploadModal";
import TeamSwitcher from "./TeamSwitcher";
import InviteTeammatesModal from "./InviteTeammatesModal";
import { UserButton, Show, SignInButton, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-ui";

export default function Navigation() {
  const pathname = usePathname();
  const { isAdmin, isClerkConfigured } = useAppAuth();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Admin sees full management suite including Coach; Members see only Call Bank
  const adminNavItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Call Bank", href: "/calls", icon: PhoneCall },
    { label: "Coach", href: "/coach", icon: GraduationCap },
    { label: "Reps", href: "/reps", icon: Users },
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { label: "Scripts", href: "/admin/scripts", icon: BookOpen },
    { label: "Invite", href: "/invite", icon: UserPlus },
  ];

  const memberNavItems = [
    { label: "Call Bank", href: "/calls", icon: PhoneCall },
    { label: "Invite", href: "/invite", icon: UserPlus },
  ];

  const currentNavItems = isAdmin ? adminNavItems : memberNavItems;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Left: Brand Logo & Navigation */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link
              href={isAdmin ? "/" : "/calls"}
              className="flex items-center gap-2.5 group transition"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                SC
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white tracking-tight text-sm sm:text-base">
                  Sales Coach
                </span>
                <span
                  suppressHydrationWarning
                  className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                    isAdmin
                      ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {isAdmin ? "Admin" : "Member"}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname === "/app"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? "bg-slate-800/90 text-white border border-slate-700/60 shadow-xs"
                        : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Actions: Team, Settings, Upload & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isClerkConfigured && (
              <div className="hidden sm:block">
                <TeamSwitcher canManage={isAdmin} />
              </div>
            )}

            {isClerkConfigured && (
              <button
                type="button"
                onClick={() => setIsInviteOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-600/30 hover:bg-sky-500 transition"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Invite teammates</span>
              </button>
            )}

            {/* Admin-only Settings Icon */}
            {isAdmin && (
              <Link
                href="/admin/settings"
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                  pathname === "/admin/settings"
                    ? "border-blue-500/40 bg-blue-500/10 text-white"
                    : "border-slate-800 bg-slate-900/70 text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
                title="Admin Settings & API Keys"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            )}

            {/* Upload Calls Action Button (Available to both Admin & Member) */}
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-600/30 transition active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Upload Calls</span>
            </button>

            {/* Auth / User Profile */}
            {isClerkConfigured ? (
              <div className="flex items-center ml-1">
                <ClerkLoading>
                  <div className="h-7 w-7 rounded-full bg-slate-800 ring-1 ring-slate-700" aria-hidden />
                </ClerkLoading>
                <ClerkLoaded>
                  <Show
                    when="signed-in"
                    fallback={
                      <SignInButton mode="redirect">
                        <button className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-md border border-slate-800 bg-slate-900 hover:bg-slate-800 transition">
                          Sign In
                        </button>
                      </SignInButton>
                    }
                  >
                    <UserButton
                      userProfileMode="modal"
                      appearance={clerkAppearance}
                    />
                  </Show>
                </ClerkLoaded>
              </div>
            ) : null}

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 px-4 py-3 space-y-2 backdrop-blur-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-xs text-slate-400">Current Role:</span>
              <span
                suppressHydrationWarning
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                  isAdmin
                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}
              >
                {isAdmin ? "Admin (Full Access)" : "Member (Calls Only)"}
              </span>
            </div>

            {isClerkConfigured && (
              <div className="sm:hidden pb-2">
                <TeamSwitcher canManage={isAdmin} />
              </div>
            )}

            <nav className="space-y-1">
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname === "/app"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? "bg-slate-800 text-white border border-slate-700/60"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {isClerkConfigured && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsInviteOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-sky-200 hover:bg-slate-900"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Invite teammates</span>
                </button>
              )}

              {isAdmin && (
                <Link
                  href="/admin/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    pathname === "/admin/settings"
                      ? "bg-slate-800 text-white border border-slate-700/60"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span>Admin Settings</span>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />
      <InviteTeammatesModal open={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
    </>
  );
}
