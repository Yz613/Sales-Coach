import type { IntegrationTool } from "./catalog";
import type { TaskProvider } from "../revenue/types";

const token = (label: string) => ({ name: "token", label, required: true });
const field = (name: string, label: string, required = true) => ({ name, label, required, type: "text" as const });
function tool(id: TaskProvider, name: string, color: string, docs: string, settings: string, fields: IntegrationTool["fields"], steps: string[], note: string): IntegrationTool {
  return { id, name, color, docs, settings, fields, category: "Tasks", syncMinutes: 15, live: "none",
    description: `Keep ${name} tasks visible and send coaching action items to your selected destination.`, steps,
    verification: `Connect, click Sync now, and confirm a known item appears in Tasks. Select a coaching action item, click Send task, and open the created item in ${name}. Complete it there and sync again to check its status.`,
    troubleshooting: [{ issue: "Connection or sync fails", fix: "Check the token's permissions and destination ID. The token owner must have access to the selected project, board or database." }, { issue: "Sending a task fails", fix: "Creation needs write access. If the delivery outcome is uncertain, check the destination first; confirm no task was created before retrying." }], note };
}
// Assumption: one selected destination per connection keeps setup and coaching follow-ups predictable.
export const TASK_TOOLS: IntegrationTool[] = [
  tool("asana", "Asana", "#f06a6a", "https://developers.asana.com/docs/personal-access-token", "https://app.asana.com/0/my-apps",
    [token("Asana personal access token"), field("targetId", "Project ID")],
    ["Open Asana's developer console → Personal access tokens and create a token.", "Copy your project's numeric ID from its URL. The token owner must be a project member.", "Enter both below. Read access imports tasks; task write access lets you send coaching action items."], "Syncs the selected project's tasks, completion, assignees and due dates. Creates follow-ups in that project without changing existing tasks."),
  tool("notion", "Notion", "#222222", "https://developers.notion.com/guides/get-started/create-a-notion-integration", "https://www.notion.so/profile/integrations",
    [token("Notion internal integration token"), field("targetId", "Database or data source ID")],
    ["Create an internal Notion integration with Read content and Insert content capabilities.", "Open the task database → Connections and add your integration. Copy the database ID from its URL.", "For a database with multiple data sources, enter the intended data source ID instead. Connect below."], "Uses the data source API and discovers the title property. Reads status, checkbox, assignee and date properties where present. New pages contain the coaching action and call link; existing pages remain unchanged."),
  tool("trello", "Trello", "#0052cc", "https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/", "https://trello.com/power-ups/admin",
    [field("apiKey", "Trello API key"), token("Trello user token"), field("targetId", "Board ID or short ID"), field("listId", "Destination list ID")],
    ["Create a Trello Power-Up API key and authorize a user token with read and write scopes.", "Copy the board ID or short ID from its URL. Obtain the destination list ID from the board's JSON export or lists API.", "Enter the board and list IDs. The list must belong to that board; new coaching cards are added there."], "Reads all cards on one board, including archived cards. An archived card is shown as archived; custom Done lists do not imply completion."),
  tool("clickup", "ClickUp", "#7b68ee", "https://developer.clickup.com/docs/authentication", "https://app.clickup.com/settings/apps",
    [token("ClickUp personal API token"), field("targetId", "List ID")],
    ["Open ClickUp Settings → Apps and generate a personal API token.", "Use Copy link on your List; its numeric list ID follows /li in the URL.", "Enter the token and list ID. The token owner needs task creation access to that List."], "Reads open and closed tasks, subtasks and tasks in multiple lists. Uses your List's workflow for completion; new tasks use its default status."),
  tool("monday", "monday.com", "#ffcb00", "https://developer.monday.com/api-reference/docs/authentication", "https://monday.com",
    [token("monday.com personal API token"), field("targetId", "Board ID")],
    ["Open your monday.com profile → Developers → My access tokens and copy a personal API token.", "Copy the numeric board ID from the board URL and make sure the token owner can view and create items there.", "Connect below. Coaching follow-ups are created as new items using the action text as their name."], "Reads active board items and status/people/date columns. Creation sends the action text as the item name; it does not assume custom column IDs or add an update. The call link is retained in Sales Coach."),
  tool("linear", "Linear", "#5e6ad2", "https://linear.app/developers/graphql", "https://linear.app/settings/api",
    [token("Linear personal API key"), field("targetId", "Team ID")],
    ["Open Linear Settings → Security & access and create a personal API key with read and issue creation access.", "Open the team page, press Cmd/Ctrl+K, and choose Copy model UUID. Use the team UUID rather than its issue prefix.", "Enter the key and team ID to sync issues and create coaching follow-ups for that team."], "Reads team issues, workflow status, assignee and due date. Creates issues with the coaching action and call link; no workflow or assignee changes are made."),
  tool("todoist", "Todoist", "#e44332", "https://developer.todoist.com/api/v1/", "https://app.todoist.com/app/settings/integrations/developer",
    [token("Todoist API token"), field("targetId", "Project ID")],
    ["Open Todoist Settings → Integrations → Developer and copy your API token.", "Use GET /api/v1/projects in Todoist's API reference to find the current project ID. Legacy numeric IDs are not accepted by API v1.", "Connect below to import active tasks and send coaching action items to that project."], "Uses Todoist API v1. Imports active tasks; completed/deleted tasks disappear from the active snapshot and are marked archived locally. New tasks include the action and call link."),
  tool("airtable", "Airtable", "#18bfff", "https://www.airtable.com/developers/web/api/introduction", "https://airtable.com/create/tokens",
    [token("Airtable personal access token"), field("baseId", "Base ID (app…)"), field("targetId", "Table ID or name"), field("titleField", "Title field name", false), field("notesField", "Notes field name (optional)", false)],
    ["Create a personal access token with data.records:read and data.records:write for the selected base.", "Copy the app… base ID and table ID/name. The title field should be writable text; its default name is Name.", "Enter an optional writable notes field if you want the action details and call link included in the new record."], "Reads records from one table. The title field defaults to Name; Status, Assignee and Due date are read if present. New records write only the configured title and optional notes fields."),
  tool("github", "GitHub", "#24292f", "https://docs.github.com/en/rest/issues/issues", "https://github.com/settings/personal-access-tokens",
    [token("GitHub fine-grained access token"), field("targetId", "Repository (owner/name)")],
    ["Create a fine-grained token for the selected repository with Issues read/write access and repository metadata read access.", "Allow organization approval or SSO authorization if required. Make sure Issues are enabled in the repository.", "Enter owner/name below. Coaching follow-ups are created as issues with the action text and call link."], "GitHub.com repositories only. Reads open and closed issues and excludes pull requests. Repository permissions govern who can see exported coaching tasks."),
  tool("gitlab", "GitLab", "#fc6d26", "https://docs.gitlab.com/api/issues/", "https://gitlab.com/-/user_settings/personal_access_tokens",
    [token("GitLab project access token"), field("targetId", "Project ID or group/project path")],
    ["Create a project access token for the selected project with read_api for imports. Enable writes below only when needed, using api and the Developer role. Personal and group tokens are rejected.", "Copy the project's numeric ID or full group/project path. Enable Issues and grant the token owner the required project role.", "Enter both below to sync issues and create coaching follow-ups."], "GitLab.com only. Reads open and closed project issues, assignees and due dates. Self-managed GitLab hosts are outside this connector's scope."),
];
