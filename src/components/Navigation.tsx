"use client";

import { useState, useEffect, useRef } from "react";
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
  UserPlus,
} from "lucide-react";
import { useAppAuth } from "@/lib/auth-context";
import UploadModal from "./UploadModal";
import TeamSwitcher from "./TeamSwitcher";
import { UserButton, Show, SignInButton, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-ui";

export default function Navigation() {
  const pathname = usePathname();
  const { role, isAdmin, isClerkConfigured, switchRole, isLoading } = useAppAuth();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadInitialTab, setUploadInitialTab] = useState<"paste" | "single_file" | "batch">("paste");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);

  const adminDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        adminDropdownRef.current &&
        !adminDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAdminDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAdminDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Close dropdown on route changes
  useEffect(() => {
    setIsAdminDropdownOpen(false);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Primary navigation items (core daily workflow)
  const primaryNavItems = isAdmin
    ? [
        { label: "Dashboard", href: "/", icon: LayoutDashboard },
        { label: "Call Bank", href: "/calls", icon: PhoneCall },
        { label: "Coach", href: "/coach", icon: GraduationCap },
        { label: "Reps", href: "/reps", icon: Users },
      ]
    : [
        { label: "Call Bank", href: "/calls", icon: PhoneCall },
      ];

  // Admin dropdown menu items (consolidates Analytics, Scripts, and Settings)
  const adminMenuItems = [
    {
      label: "Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      description: "Team performance, scores & trends",
      badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Scripts",
      href: "/admin/scripts",
      icon: BookOpen,
      description: "Evaluation rubrics & talk tracks",
      badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Settings",
      href: "/admin/settings",
      icon: Settings,
      description: "API keys, model parameters & configs",
      badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
    {
      label: "Invite",
      href: "/invite",
      icon: UserPlus,
      description: "Email teammates a join link, with a copyable fallback",
      badgeColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    },
  ];

  const visibleAdminMenuItems = adminMenuItems.filter(
    (item) => item.href !== "/invite" || isClerkConfigured
  );

  const isAdminActive =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/invite") ||
    visibleAdminMenuItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  const handleRoleChange = async (newRole: "admin" | "member") => {
    setIsAdminDropdownOpen(false);
    if (newRole !== role) {
      await switchRole(newRole);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/70 backdrop-blur-2xl shadow-sm shadow-black/20">
        <div className="mx-auto flex max-w-[1600px] w-full items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          {/* Left: Brand Logo & Navigation */}
          <div className="flex items-center gap-5 lg:gap-7">
            <Link
              href={isAdmin ? "/" : "/calls"}
              className="flex items-center gap-2.5 group transition shrink-0"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform border border-white/20">
                SC
              </div>
              <span className="font-semibold text-white tracking-tight text-sm sm:text-base">
                Sales Coach
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1.5">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/" || pathname === "/app"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                      isActive
                        ? "bg-white/[0.08] text-white border border-white/[0.12] shadow-xs backdrop-blur-md"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Admin Tools Dropdown Menu */}
              {isAdmin && (
                <div className="relative" ref={adminDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsAdminDropdownOpen((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                      isAdminActive || isAdminDropdownOpen
                        ? "bg-white/[0.08] text-white border border-white/[0.12] shadow-xs ring-1 ring-indigo-500/30 backdrop-blur-md"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                    aria-expanded={isAdminDropdownOpen}
                    aria-haspopup="true"
                  >
                    <ShieldCheck
                      className={`h-3.5 w-3.5 ${
                        isAdminActive ? "text-indigo-400" : "text-slate-400"
                      }`}
                    />
                    <span>Admin</span>
                    <ChevronDown
                      className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
                        isAdminDropdownOpen ? "rotate-180 text-white" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu Popover */}
                  {isAdminDropdownOpen && (
                    <div className="absolute left-0 mt-2.5 w-76 rounded-2xl border border-white/[0.1] bg-slate-900/90 p-2 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-3 py-2 pb-2.5 border-b border-white/[0.08] flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Admin Controls
                        </span>
                        <span className="text-[10px] text-indigo-300 font-medium bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                          Full Access
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {visibleAdminMenuItems.map((item) => {
                          const Icon = item.icon;
                          const isItemActive =
                            pathname === item.href || pathname.startsWith(`${item.href}/`);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsAdminDropdownOpen(false)}
                              className={`flex items-start gap-3 rounded-xl p-2.5 transition ${
                                isItemActive
                                  ? "bg-white/[0.08] text-white border border-white/[0.12] shadow-xs"
                                  : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                              }`}
                            >
                              <div
                                className={`p-2 rounded-xl border shrink-0 mt-0.5 ${item.badgeColor}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold">{item.label}</span>
                                  {isItemActive && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400"></span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {item.description}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {/* Role Preview Switch in Admin dropdown */}
                      <div className="p-2.5 border-t border-white/[0.08] mt-1.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 px-1 flex items-center justify-between">
                          <span>Permissions Preview</span>
                          <span className="text-[9px] text-slate-400 capitalize">{role} view</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRoleChange("admin")}
                            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-medium transition ${
                              isAdmin
                                ? "bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30"
                                : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
                            }`}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Admin View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRoleChange("member")}
                            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-medium transition ${
                              !isAdmin
                                ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                                : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
                            }`}
                          >
                            <User className="h-3.5 w-3.5" />
                            Member View
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>

          {/* Right Actions: Team Switcher, Member View Exit Pill, Upload Calls & Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* If currently viewing as Member, provide quick exit button back to Admin */}
            {!isAdmin && (
              <button
                type="button"
                onClick={() => handleRoleChange("admin")}
                className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition backdrop-blur-md"
                title="You are previewing Member view. Click to return to Admin."
              >
                <User className="h-3.5 w-3.5 text-amber-400" />
                <span>Member View</span>
                <span className="text-[9px] bg-amber-500/20 px-1.5 py-0.5 rounded-full font-semibold text-amber-200">Exit</span>
              </button>
            )}

            {isClerkConfigured && (
              <div className="hidden sm:block">
                <TeamSwitcher canManage={isAdmin} />
              </div>
            )}

            {/* Upload Calls Action Button */}
            <button
              onClick={() => {
                setUploadInitialTab("paste");
                setIsUploadOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Upload Calls</span>
            </button>

            {/* Auth / User Profile */}
            {isClerkConfigured ? (
              <div className="flex items-center ml-1">
                <ClerkLoading>
                  <div className="h-7 w-7 rounded-full bg-slate-800 ring-1 ring-white/10" aria-hidden />
                </ClerkLoading>
                <ClerkLoaded>
                  <Show
                    when="signed-in"
                    fallback={
                      <SignInButton mode="redirect">
                        <button className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] transition backdrop-blur-md">
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
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-400 hover:text-white transition"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-slate-950/95 px-4 py-3 space-y-3 backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <span className="text-xs text-slate-400">Current Role:</span>
              <span
                suppressHydrationWarning
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
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

            {/* Primary navigation items */}
            <nav className="space-y-1">
              {primaryNavItems.map((item) => {
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
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                      isActive
                        ? "bg-white/[0.1] text-white border border-white/[0.12] shadow-xs"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Admin suite section on mobile */}
              {isAdmin && (
                <div className="pt-2.5 mt-2 border-t border-white/[0.08] space-y-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Admin Tools
                  </div>
                  {visibleAdminMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isItemActive =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                          isItemActive
                            ? "bg-white/[0.1] text-white border border-white/[0.12] shadow-xs"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        initialTab={uploadInitialTab}
      />
    </>
  );
}
