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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);

  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        adminDropdownRef.current &&
        !adminDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAdminDropdownOpen(false);
      }
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRoleDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAdminDropdownOpen(false);
        setIsRoleDropdownOpen(false);
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

  // Close dropdowns on route changes
  useEffect(() => {
    setIsAdminDropdownOpen(false);
    setIsRoleDropdownOpen(false);
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
      description: "Send join links from the invite page only",
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
          <div className="flex items-center gap-5 lg:gap-7">
            <Link
              href={isAdmin ? "/" : "/calls"}
              className="flex items-center gap-2.5 group transition shrink-0"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                SC
              </div>
              <span className="font-semibold text-white tracking-tight text-sm sm:text-base">
                Sales Coach
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
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

              {/* Admin Tools Dropdown Menu */}
              {isAdmin && (
                <div className="relative" ref={adminDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminDropdownOpen((prev) => !prev);
                      setIsRoleDropdownOpen(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isAdminActive || isAdminDropdownOpen
                        ? "bg-slate-800/90 text-white border border-slate-700/60 shadow-xs ring-1 ring-indigo-500/30"
                        : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
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
                    <div className="absolute left-0 mt-2 w-72 rounded-xl border border-slate-800/90 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-2.5 py-1.5 pb-2 border-b border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Admin Controls
                        </span>
                        <span className="text-[10px] text-indigo-400 font-medium bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                          Full Access
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {visibleAdminMenuItems.map((item) => {
                          const Icon = item.icon;
                          const isItemActive =
                            pathname === item.href || pathname.startsWith(`${item.href}/`);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsAdminDropdownOpen(false)}
                              className={`flex items-start gap-2.5 rounded-lg p-2 transition ${
                                isItemActive
                                  ? "bg-slate-800/90 text-white border border-slate-700/60 shadow-xs"
                                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                              }`}
                            >
                              <div
                                className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${item.badgeColor}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold">{item.label}</span>
                                  {isItemActive && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
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
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>

          {/* Right Actions: Team Switcher, Role Switcher, Upload Calls & Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isClerkConfigured && (
              <div className="hidden sm:block">
                <TeamSwitcher canManage={isAdmin} />
              </div>
            )}

            {/* Interactive Role Switcher / View Preview */}
            <div className="relative" ref={roleDropdownRef}>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => {
                  setIsRoleDropdownOpen((prev) => !prev);
                  setIsAdminDropdownOpen(false);
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-slate-700"
                title="Switch permissions view (Admin / Member)"
              >
                {isAdmin ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                ) : (
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span className="hidden sm:inline text-slate-400">Role:</span>
                <span suppressHydrationWarning className="font-semibold text-white capitalize">
                  {role}
                </span>
                <ChevronDown
                  className={`h-3 w-3 text-slate-500 ml-0.5 transition-transform duration-200 ${
                    isRoleDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Role Dropdown Menu */}
              {isRoleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
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
                      Organization admins have full access
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Upload Calls Action Button */}
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
          <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 px-4 py-3 space-y-3 backdrop-blur-xl">
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

              {/* Admin suite section on mobile */}
              {isAdmin && (
                <div className="pt-2 mt-2 border-t border-slate-800/80 space-y-1">
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
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                          isItemActive
                            ? "bg-slate-800 text-white border border-slate-700/60"
                            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
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
      />
    </>
  );
}
