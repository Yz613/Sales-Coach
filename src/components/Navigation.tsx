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
  ShieldCheck,
  User,
  Check,
  ChevronDown,
  GraduationCap,
} from "lucide-react";
import { useAppAuth } from "@/lib/auth-context";
import UploadModal from "./UploadModal";
import { UserButton, Show, SignInButton, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";

export default function Navigation() {
  const pathname = usePathname();
  const { role, isAdmin, isClerkConfigured, switchRole, isLoading } = useAppAuth();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  // Admin sees full management suite including Coach; Members see only Call Bank
  const adminNavItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Call Bank", href: "/calls", icon: PhoneCall },
    { label: "Coach", href: "/coach", icon: GraduationCap },
    { label: "Reps", href: "/reps", icon: Users },
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { label: "Scripts", href: "/admin/scripts", icon: BookOpen },
  ];

  const memberNavItems = [
    { label: "Call Bank", href: "/calls", icon: PhoneCall },
  ];

  const currentNavItems = isAdmin ? adminNavItems : memberNavItems;

  const handleRoleChange = async (newRole: "admin" | "member") => {
    setIsRoleDropdownOpen(false);
    if (newRole !== role) {
      await switchRole(newRole);
    }
  };

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

          {/* Right Actions: Role Preview, Settings, Upload & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Interactive Role Switcher / Preview */}
            <div className="relative">
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition"
                title="Switch permissions view (Admin / Member)"
              >
                {isAdmin ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                ) : (
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span className="hidden sm:inline">Role:</span>
                <span suppressHydrationWarning className="font-semibold text-white capitalize">{role}</span>
                <ChevronDown className="h-3 w-3 text-slate-500 ml-0.5" />
              </button>

              {/* Role Dropdown Menu */}
              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-xl backdrop-blur-xl z-50">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Permissions Mode
                  </div>
                  <button
                    onClick={() => handleRoleChange("admin")}
                    className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                      isAdmin
                        ? "bg-indigo-500/15 text-indigo-300 font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                      Admin (Full Access)
                    </span>
                    {isAdmin && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                  </button>
                  <button
                    onClick={() => handleRoleChange("member")}
                    className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                      !isAdmin
                        ? "bg-emerald-500/15 text-emerald-300 font-semibold"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-emerald-400" />
                      Member (Calls Only)
                    </span>
                    {!isAdmin && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </button>
                  {isClerkConfigured && (
                    <div className="border-t border-slate-800 mt-1.5 pt-1.5 px-2 text-[10px] text-slate-500">
                      Clerk authentication active
                    </div>
                  )}
                </div>
              )}
            </div>

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
                      appearance={{
                        elements: {
                          avatarBox: "h-7 w-7 ring-1 ring-slate-700",
                        },
                      }}
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
    </>
  );
}
