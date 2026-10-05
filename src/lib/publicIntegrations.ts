import { INTEGRATION_TOOLS, type IntegrationTool } from "./integrations/catalog";
import { INTEGRATION_LOGOS } from "./integrations/logos";
import { apiPath } from "./utils";

/** Public labels for the connector categories already in the product. */
export const PUBLIC_INTEGRATION_CATEGORIES = [
  "Meetings",
  "CRM",
  "Calendar",
  "Email",
  "Tasks",
  "Chat",
  "Automation",
] as const;

export type PublicIntegrationCategory = (typeof PUBLIC_INTEGRATION_CATEGORIES)[number];

const CATEGORY_FROM_TOOL: Record<IntegrationTool["category"], PublicIntegrationCategory> = {
  Calls: "Meetings",
  CRM: "CRM",
  Meetings: "Calendar",
  Email: "Email",
  Tasks: "Tasks",
  Notifications: "Chat",
  Automation: "Automation",
};

/**
 * One line each, matching the implemented scope in docs/INTEGRATIONS.md
 * ("Current library") and the connector catalog. Not roadmap items.
 */
const BLURBS: Record<IntegrationTool["id"], string> = {
  fathom: "Meetings, transcripts, summaries, action items, and a recording player.",
  fireflies: "Transcripts, speaker timestamps, summaries, and action items.",
  tldv: "Meetings and timestamped transcripts.",
  gong: "Call metadata, participants, and transcripts.",
  close: "Completed call and voicemail transcripts.",
  aircall: "Completed transcripts, summaries, speaker timing, and recording links.",
  quo: "Completed calls, recordings, transcripts, speaker timing, and summaries.",
  zoom: "Completed cloud recordings, transcripts, and speaker timestamps.",
  hubspot: "Companies, contacts, deals, call notes, and mapped coaching properties.",
  pipedrive: "Organizations, people, deals, and stages.",
  attio: "Companies, people, deals, and relationships.",
  calendly: "Scheduled meetings, active invitees, and cancellations.",
  "google-calendar": "Primary calendar events, recurring instances, and attendees.",
  "outlook-calendar": "Default calendar events, recurring instances, and attendees.",
  gmail: "Matching Gmail metadata and a short snippet on deal timelines.",
  outlook: "Matching Outlook metadata and a short snippet on deal timelines.",
  asana: "Coaching follow-ups in a selected project.",
  notion: "Coaching follow-ups in a selected database.",
  trello: "Coaching follow-ups on a selected board and list.",
  clickup: "Coaching follow-ups in a selected list.",
  monday: "Coaching follow-ups on a selected board.",
  linear: "Coaching follow-ups in a selected team.",
  todoist: "Coaching follow-ups in a selected project.",
  airtable: "Coaching follow-ups in a selected table.",
  github: "Coaching follow-ups as issues in a selected repository.",
  gitlab: "Coaching follow-ups as issues in a selected project.",
  slack: "Opt-in alerts for reviewed calls, clips, low scores, and saved streams.",
  discord: "Opt-in alerts for reviewed calls, clips, low scores, and saved streams.",
  zapier: "Bring in completed call transcripts, or send summaries and next steps to a Zap.",
  make: "Bring in completed call transcripts, or send coaching events to a scenario.",
};

/** Display order within the public page. New catalog tools append after these. */
const DISPLAY_ORDER: IntegrationTool["id"][] = [
  "fathom",
  "fireflies",
  "tldv",
  "gong",
  "close",
  "aircall",
  "quo",
  "zoom",
  "hubspot",
  "pipedrive",
  "attio",
  "calendly",
  "google-calendar",
  "outlook-calendar",
  "gmail",
  "outlook",
  "asana",
  "notion",
  "trello",
  "clickup",
  "monday",
  "linear",
  "todoist",
  "airtable",
  "github",
  "gitlab",
  "slack",
  "discord",
  "zapier",
  "make",
];

export type PublicIntegration = {
  id: IntegrationTool["id"];
  name: string;
  category: PublicIntegrationCategory;
  description: string;
  logoSrc: string;
  available: true;
};

function publicIntegration(tool: IntegrationTool): PublicIntegration {
  const description = BLURBS[tool.id];
  if (!description) {
    throw new Error(`Missing public description for integration ${tool.id}`);
  }
  return {
    id: tool.id,
    name: tool.name,
    category: CATEGORY_FROM_TOOL[tool.category],
    description,
    logoSrc: apiPath(`/integrations/${INTEGRATION_LOGOS[tool.id]}`),
    available: true,
  };
}

const toolsById = new Map(INTEGRATION_TOOLS.map((tool) => [tool.id, tool]));

export const PUBLIC_INTEGRATIONS: PublicIntegration[] = [
  ...DISPLAY_ORDER.filter((id) => toolsById.has(id)).map((id) => publicIntegration(toolsById.get(id)!)),
  ...INTEGRATION_TOOLS.filter((tool) => !DISPLAY_ORDER.includes(tool.id)).map(publicIntegration),
];

export const PUBLIC_INTEGRATION_COUNT = PUBLIC_INTEGRATIONS.length;

export function publicIntegrationGroups(): {
  category: PublicIntegrationCategory;
  items: PublicIntegration[];
}[] {
  return PUBLIC_INTEGRATION_CATEGORIES.map((category) => ({
    category,
    items: PUBLIC_INTEGRATIONS.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
}
