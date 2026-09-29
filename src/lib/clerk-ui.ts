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
    colorPrimary: "#007AFF",
    colorBackground: "#ffffff",
    colorInputBackground: "#F2F2F7",
    colorInputText: "#1d1d1f",
    colorText: "#1d1d1f",
    colorTextSecondary: "#6e6e73",
    colorNeutral: "#86868b",
    borderRadius: "12px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
  },
  elements: {
    avatarBox: "h-7 w-7 ring-1 ring-black/10 rounded-full",
    userButtonBox: "flex items-center",
    organizationSwitcherTrigger:
      "rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[#1d1d1f] hover:bg-black/[0.04] transition",
    organizationPreviewMainIdentifier: "text-[#1d1d1f] font-medium",
    card: "bg-white border border-black/[0.08] shadow-[0_20px_48px_rgba(0,0,0,0.08)] rounded-3xl",
    formButtonPrimary: "bg-[#007AFF] hover:bg-[#0071E3] text-white shadow-xs font-semibold rounded-xl text-sm",
    formFieldInput: "bg-[#F2F2F7] border border-black/[0.08] text-[#1d1d1f] focus:border-[#007AFF] rounded-xl text-sm",
    formFieldLabel: "text-[#3a3a3c] font-medium text-xs",
    dividerText: "text-[#6e6e73] text-xs",
    socialButtonsBlockButtonText: "text-[#1d1d1f] font-medium",
    headerTitle: "text-[#1d1d1f] font-semibold tracking-tight",
    headerSubtitle: "text-[#6e6e73] text-xs",
    modalBackdrop: "z-[80] bg-black/25",
    modalContent: "z-[90]",
    userButtonPopoverCard: "bg-white border border-black/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.12)] rounded-2xl p-2",
    userButtonPopoverActionButton: "text-[#1d1d1f] hover:bg-black/[0.04] rounded-xl transition",
    userButtonPopoverActionButtonText: "text-[#1d1d1f] font-medium text-xs",
    userButtonPopoverActionButtonIcon: "text-[#6e6e73]",
    organizationSwitcherPopoverCard: "bg-white border border-black/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.12)] rounded-2xl p-2",
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
