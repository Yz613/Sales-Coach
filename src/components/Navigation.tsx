"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
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
  GraduationCap,
  UserPlus,
  ShieldCheck,
  Plug,
  Briefcase,
} from "lucide-react";
import { useAppAuth } from "@/lib/auth-context";
import TeamSwitcher from "./TeamSwitcher";
import { UserButton, Show, SignInButton, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-ui";

const UploadModal = dynamic(() => import("./UploadModal"), { ssr: false });

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

function isItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RoleNavPlaceholder() {
  return (
    <div className="flex flex-1 flex-col gap-2 px-1" aria-hidden>
      {["role-a", "role-b", "role-c", "role-d"].map((key) => (
        <div key={key} className="h-8 rounded-[8px] bg-black/[0.05]" />
      ))}
    </div>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const { isAdmin, isClerkConfigured, isLoading: authLoading } = useAppAuth();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadInitialTab, setUploadInitialTab] = useState<"paste" | "single_file" | "batch">("paste");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const primaryNavItems: NavItem[] = authLoading
    ? []
    : isAdmin
      ? [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Conversations", href: "/conversations", icon: PhoneCall },
          { label: "Coach", href: "/coach", icon: GraduationCap },
          { label: "Reps", href: "/reps", icon: Users },
        ]
      : [
          { label: "Conversations", href: "/conversations", icon: PhoneCall },
          { label: "Library", href: "/library", icon: BookOpen },
          ...(isClerkConfigured ? [{ label: "Invite", href: "/invite", icon: UserPlus }] : []),
        ];

  if (!authLoading && isClerkConfigured) {
    primaryNavItems.push({ label: "Main menu", href: "/workspaces", icon: LayoutDashboard });
  }

  const homeHref = authLoading || isAdmin ? "/" : "/calls";
  const roleLabel = authLoading ? "Loading" : isAdmin ? "Admin" : "Member";

  const adminMenuItems: NavItem[] = [
    { label: "Deals", href: "/deals", icon: Briefcase },
    { label: "Forecast", href: "/forecast", icon: BarChart3 },
    { label: "Call scorecards", href: "/calls", icon: PhoneCall },
    { label: "Coaching library", href: "/library", icon: BookOpen },
    { label: "Integrations", href: "/admin/integrations", icon: Plug },
    { label: "Data & privacy", href: "/admin/privacy", icon: ShieldCheck },
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    { label: "Scripts", href: "/admin/scripts", icon: BookOpen },
    { label: "Settings", href: "/admin/settings", icon: Settings },
    ...(isClerkConfigured ? [{ label: "Invite", href: "/invite", icon: UserPlus }] : []),
  ];

  const openUpload = () => {
    setUploadInitialTab("paste");
    setIsUploadOpen(true);
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-black/[0.08] bg-[#EFEFF4] px-3 py-4 md:flex" aria-busy={authLoading}>
        <Link href={homeHref} className="mb-5 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#007AFF] text-[11px] font-semibold tracking-tight text-white shadow-xs">
            SC
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">Sales Coach</div>
            <div className="text-[11px] text-[#86868b] font-normal">{roleLabel}</div>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {authLoading ? <RoleNavPlaceholder /> : primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] text-[13px] transition-colors ${
                  active ? "bg-[#007AFF] text-white font-semibold shadow-xs" : "text-[#1d1d1f] font-medium hover:bg-black/[0.05]"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-[#6e6e73]"}`} strokeWidth={active ? 2 : 1.75} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {!authLoading && isAdmin && (
            <>
              <div className="px-2.5 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Admin</div>
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] text-[13px] transition-colors ${
                      active ? "bg-[#007AFF] text-white font-semibold shadow-xs" : "text-[#1d1d1f] font-medium hover:bg-black/[0.05]"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-[#6e6e73]"}`} strokeWidth={active ? 2 : 1.75} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      <div className="sticky top-0 z-30 flex h-[52px] items-center justify-between gap-3 border-b border-black/[0.06] bg-[#F5F5F7] px-4 md:justify-end md:px-8">
        <Link href={homeHref} className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#007AFF] text-[10px] font-semibold text-white shadow-xs">
            SC
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">Sales Coach</span>
        </Link>

        <div className="flex items-center gap-2.5">
          {isClerkConfigured && (
            <div className="hidden sm:block">
              <TeamSwitcher canManage={isAdmin} />
            </div>
          )}
          <button
            onClick={openUpload}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-[#007AFF] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#0071E3] active:scale-[0.98] shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            <span>Upload</span>
          </button>
          {isClerkConfigured ? (
            <div className="ml-0.5 flex items-center">
              <ClerkLoading>
                <div className="h-7 w-7 rounded-full bg-[#E5E5EA]" aria-hidden />
              </ClerkLoading>
              <ClerkLoaded>
                <Show
                  when="signed-in"
                  fallback={
                    <SignInButton mode="redirect">
                      <button className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#007AFF] hover:bg-[#007AFF]/10">
                        Sign in
                      </button>
                    </SignInButton>
                  }
                >
                  <UserButton userProfileMode="modal" appearance={clerkAppearance} />
                </Show>
              </ClerkLoaded>
            </div>
          ) : (
            <div className="hidden h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-medium text-[#3a3a3c] border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-[#007AFF]" />
              <span>Local Admin</span>
            </div>
          )}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-[#F8F8F8] pb-[env(safe-area-inset-bottom)] md:hidden" aria-busy={authLoading}>
        {authLoading ? (
          <div className="flex items-center justify-center py-3 text-[11px] text-[#86868b]">Loading</div>
        ) : (
        <div
          className="grid items-center"
          style={{ gridTemplateColumns: `repeat(${primaryNavItems.length + (isAdmin ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors ${
                  active ? "text-[#007AFF] font-semibold" : "text-[#8E8E93] font-medium"
                }`}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors ${
                isMobileMenuOpen || pathname.startsWith("/admin") || pathname.startsWith("/invite")
                  ? "text-[#007AFF] font-semibold"
                  : "text-[#8E8E93] font-medium"
              }`}
            >
              <ShieldCheck className="h-[22px] w-[22px]" strokeWidth={1.75} />
              <span>More</span>
            </button>
          )}
        </div>
        )}
      </nav>

      {isMobileMenuOpen && isAdmin && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div ref={moreRef} className="fixed inset-x-3 bottom-[calc(60px+env(safe-area-inset-bottom,0px))] z-50 rounded-[18px] border border-black/[0.08] bg-white p-2 shadow-[0_12px_36px_rgba(0,0,0,0.14)] md:hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">Admin</div>
            {isClerkConfigured && (
              <div className="px-2 pb-2 sm:hidden">
                <TeamSwitcher canManage={isAdmin} />
              </div>
            )}
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] transition-colors ${
                    active ? "bg-[#007AFF] text-white font-semibold" : "text-[#1d1d1f] font-medium hover:bg-black/[0.04]"
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-[#6e6e73]"}`} strokeWidth={active ? 2 : 1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {isUploadOpen ? (
        <UploadModal
          isOpen
          onClose={() => setIsUploadOpen(false)}
          initialTab={uploadInitialTab}
        />
      ) : null}
    </>
  );
}
