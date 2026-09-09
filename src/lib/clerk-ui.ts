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
  selectOrganization: clerkUrl("/select-organization"),
  createOrganization: clerkUrl("/create-organization"),
  userProfile: clerkUrl("/user"),
  organizationProfile: clerkUrl("/organization"),
  adminSettings: clerkUrl("/admin/settings"),
};

export const clerkAppearance = {
  layout: {
    logoPlacement: "none" as const,
    shimmer: false,
  },
  variables: {
    colorPrimary: "#3b82f6",
    colorBackground: "#0f172a",
    colorInputBackground: "#020617",
    colorInputText: "#f8fafc",
    colorText: "#e2e8f0",
    colorTextSecondary: "#94a3b8",
    colorNeutral: "#64748b",
    borderRadius: "0.5rem",
  },
  elements: {
    avatarBox: "h-7 w-7 ring-1 ring-slate-700",
    userButtonBox: "flex items-center",
    organizationSwitcherTrigger:
      "rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-slate-200 hover:bg-slate-800/80",
    organizationPreviewMainIdentifier: "text-slate-100",
    card: "bg-slate-900 border border-slate-800 shadow-xl",
    headerTitle: "text-white",
    headerSubtitle: "text-slate-400",
    modalBackdrop: "z-[80]",
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
