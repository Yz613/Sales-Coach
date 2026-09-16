import { BASE_PATH } from "@/lib/utils";

/** Paths Clerk's own navigator uses — it does not prepend Next.js `basePath`. */
export function clerkUrl(path: string = "/"): string {
  if (!path || path === "/") return BASE_PATH || "/";
  if (path.startsWith("http") || path.startsWith(BASE_PATH)) return path;
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export const CLERK_PATHS = {
  signIn: clerkUrl("/sign-in"),
  signUp: clerkUrl("/sign-up"),
  afterSignOut: clerkUrl("/sign-in"),
  afterSignIn: clerkUrl("/"),
  subscribe: clerkUrl("/subscribe"),
  selectOrganization: clerkUrl("/select-organization"),
  createOrganization: clerkUrl("/create-organization"),
  userProfile: clerkUrl("/user"),
  organizationProfile: clerkUrl("/organization"),
  adminSettings: clerkUrl("/admin/settings"),
  acceptInvite: clerkUrl("/accept-invite"),
};

export const clerkAppearance = {
  layout: {
    logoPlacement: "none" as const,
    shimmer: false,
  },
  variables: {
    colorPrimary: "#3b82f6",
    colorBackground: "#0a0f1d",
    colorInputBackground: "#050811",
    colorInputText: "#f8fafc",
    colorText: "#e2e8f0",
    colorTextSecondary: "#94a3b8",
    colorNeutral: "#64748b",
    borderRadius: "0.875rem",
  },
  elements: {
    avatarBox: "h-7 w-7 ring-1 ring-white/10 rounded-xl",
    userButtonBox: "flex items-center",
    organizationSwitcherTrigger:
      "rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-slate-200 hover:bg-white/[0.08] transition",
    organizationPreviewMainIdentifier: "text-slate-100 font-medium",
    card: "bg-slate-950/85 backdrop-blur-2xl border border-white/[0.1] shadow-2xl rounded-3xl",
    headerTitle: "text-white font-semibold",
    headerSubtitle: "text-slate-400 text-xs",
    modalBackdrop: "z-[80] backdrop-blur-md bg-slate-950/80",
    modalContent: "z-[90]",
    footer: "hidden",
    footerAction: "hidden",
  },
};

/** User-facing copy uses “team”, never vendor product names. */
export const teamLocalization = {
  organizationSwitcher: {
    action__manageOrganization: "Manage team",
    action__createOrganization: "Create team",
    notSelected: "No team selected",
  },
  organizationList: {
    title: "Choose a team",
    titleWithoutPersonal: "Choose a team",
    action__createOrganization: "Create team",
    subtitle: "Select a team to continue",
  },
  createOrganization: {
    title: "Create a team",
    formButtonSubmit: "Create team",
  },
};
