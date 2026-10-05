import type { ProviderId } from "../revenue/types";

/** Exhaustive so every integration has a locally served brand mark. */
export const INTEGRATION_LOGOS: Record<ProviderId, string> = {
  fathom: "fathom.png", fireflies: "fireflies.png", tldv: "tldv.png", gong: "gong.svg", close: "close.png",
  hubspot: "hubspot.svg", pipedrive: "pipedrive.png", attio: "attio.ico", zapier: "zapier.ico", make: "make.svg",
  asana: "asana.svg", notion: "notion.svg", trello: "trello.svg", clickup: "clickup.svg", monday: "monday.png",
  linear: "linear.svg", todoist: "todoist.svg", airtable: "airtable.svg", github: "github.svg", gitlab: "gitlab.svg",
  discord: "discord.svg", slack: "slack.png", calendly: "calendly.svg", "google-calendar": "google-calendar.svg",
  "outlook-calendar": "outlook-calendar.svg", gmail: "gmail.svg", outlook: "outlook.svg", aircall: "aircall.svg", zoom: "zoom.svg",
  "google-meet": "google-meet.svg", "microsoft-teams": "teams.svg", quo: "quo.svg",
};
