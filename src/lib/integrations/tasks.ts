import { providerRequest, ProviderError } from "./http";
import { RevenueError, safeExternalUrl } from "../revenue/security";
import type { ConnectionConfig, ExternalTask, SyncCursor, TaskProvider } from "../revenue/types";

const ORIGINS: Record<TaskProvider, string> = { asana: "https://app.asana.com/api/1.0", notion: "https://api.notion.com/v1", trello: "https://api.trello.com/1", clickup: "https://api.clickup.com/api/v2", monday: "https://api.monday.com/v2", linear: "https://api.linear.app", todoist: "https://api.todoist.com/api/v1", airtable: "https://api.airtable.com/v0", github: "https://api.github.com", gitlab: "https://gitlab.com/api/v4" };
type Secrets = Record<string, string>;
const enc = encodeURIComponent;
function headers(provider: TaskProvider, secrets: Secrets) {
  const result: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${secrets.token}` };
  if (["clickup", "monday", "linear"].includes(provider)) result.Authorization = secrets.token;
  if (provider === "notion") result["Notion-Version"] = "2025-09-03";
  if (provider === "monday") result["API-Version"] = "2026-04";
  if (provider === "trello") result.Authorization = `OAuth oauth_consumer_key="${enc(secrets.apiKey)}", oauth_token="${enc(secrets.token)}"`;
  if (provider === "github") { result["X-GitHub-Api-Version"] = "2026-03-10"; result["User-Agent"] = "Sales-Coach"; }
  if (provider === "gitlab") { delete result.Authorization; result["PRIVATE-TOKEN"] = secrets.token; }
  return result;
}
function request(provider: TaskProvider, secrets: Secrets, path: string, body?: unknown) {
  return providerRequest<any>(provider, ORIGINS[provider], path, headers(provider, secrets), body === undefined ? {} : { method: "POST", body: JSON.stringify(body) });
}
async function graph(provider: "linear" | "monday", secrets: Secrets, query: string, variables: object) {
  const result = await request(provider, secrets, provider === "linear" ? "/graphql" : "", { query, variables });
  if (result.errors?.length) {
    const limited = result.errors.some((e: any) => /RATE|COMPLEXITY|THROTTL/i.test(String(e.extensions?.code || e.extensions?.error_code || "")));
    throw new ProviderError(provider, limited ? 429 : 400, limited ? 60 : 0);
  }
  if (!result.data || typeof result.data !== "object") throw new RevenueError(`${provider} returned an invalid response. Retry sync.`, 502);
  return result.data;
}
function list(value: unknown, provider: string): any[] {
  if (!Array.isArray(value) || value.length > 10000) throw new RevenueError(`${provider} returned an invalid or oversized task page.`, 502);
  return value;
}
function date(value: unknown): string | null {
  if (!value) return null; const time = typeof value === "number" || /^\d{13}$/.test(String(value)) ? Number(value) : Date.parse(String(value));
  if (!Number.isFinite(time)) return null;
  const normalized = new Date(time).toISOString();
  // Date-only deadlines must retain their calendar day in every viewer's time zone.
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? normalized.slice(0, 10) === value ? String(value) : null : normalized;
}
function task(raw: Partial<ExternalTask>): ExternalTask {
  const externalId = String(raw.externalId || ""); if (!externalId || externalId.length > 512) throw new RevenueError("The task provider returned an invalid item ID.", 502);
  return { externalId, title: String(raw.title || "Untitled task").slice(0, 500), description: String(raw.description || "").slice(0, 20000),
    status: raw.status || "open", assignee: String(raw.assignee || "").slice(0, 500), dueAt: date(raw.dueAt), sourceUrl: safeExternalUrl(raw.sourceUrl) };
}
const rich = (value: any[]) => (value || []).map(v => v.plain_text || v.text?.content || "").join("");
export function normalizeTask(provider: TaskProvider, raw: any, secrets: Secrets = {}): ExternalTask {
  if (provider === "asana") return task({ externalId: raw.gid, title: raw.name, description: raw.notes, status: raw.completed ? "completed" : "open", assignee: raw.assignee?.name, dueAt: raw.due_at || raw.due_on, sourceUrl: raw.permalink_url });
  if (provider === "notion") {
    const props: any[] = Object.values(raw.properties || {}); const status = props.find(p => p.type === "status")?.status;
    const done = Object.entries(raw.properties || {}).some(([name, p]: [string, any]) => /^(done|complete|completed)$/i.test(name) && p.type === "checkbox" && p.checkbox);
    return task({ externalId: raw.id, title: rich(props.find(p => p.type === "title")?.title), status: raw.archived || raw.in_trash ? "archived" : done || /^(done|complete|completed)$/i.test(status?.name || "") ? "completed" : "open",
      description: rich(props.find(p => p.type === "rich_text")?.rich_text), assignee: (props.find(p => p.type === "people")?.people || []).map((p: any) => p.name).join(", "), dueAt: props.find(p => p.type === "date")?.date?.start, sourceUrl: raw.url });
  }
  if (provider === "trello") return task({ externalId: raw.id, title: raw.name, description: raw.desc, status: raw.closed ? "archived" : raw.dueComplete ? "completed" : "open", dueAt: raw.due, sourceUrl: raw.url });
  if (provider === "clickup") return task({ externalId: raw.id, title: raw.name, description: raw.description, status: raw.archived ? "archived" : ["closed", "done"].includes(raw.status?.type) ? "completed" : "open", assignee: (raw.assignees || []).map((p: any) => p.username || p.email).join(", "), dueAt: raw.due_date, sourceUrl: raw.url });
  if (provider === "monday") return task({ externalId: raw.id, title: raw.name, status: raw.state && raw.state !== "active" ? "archived" : (raw.column_values || []).some((c: any) => c.type === "status" && /^(done|complete|completed)$/i.test(c.text || "")) ? "completed" : "open", assignee: (raw.column_values || []).find((c: any) => c.type === "people")?.text, dueAt: (raw.column_values || []).find((c: any) => c.type === "date")?.text, sourceUrl: raw.url });
  if (provider === "linear") return task({ externalId: raw.id, title: raw.title, description: raw.description, status: raw.archivedAt || raw.state?.type === "canceled" ? "archived" : raw.state?.type === "completed" ? "completed" : "open", assignee: raw.assignee?.name, dueAt: raw.dueDate, sourceUrl: raw.url });
  if (provider === "todoist") return task({ externalId: raw.id, title: raw.content, description: raw.description, status: raw.is_deleted ? "archived" : raw.checked || raw.is_completed ? "completed" : "open", dueAt: raw.due?.datetime || raw.due?.date, sourceUrl: `https://app.todoist.com/app/task/${enc(raw.id)}` });
  if (provider === "airtable") { const f = raw.fields || {}; return task({ externalId: raw.id, title: f[secrets.titleField || "Name"], description: secrets.notesField ? f[secrets.notesField] : "", status: /^(done|complete|completed)$/i.test(f.Status || "") ? "completed" : "open", assignee: Array.isArray(f.Assignee) ? f.Assignee.map((p: any) => p.name || p.email || p).join(", ") : f.Assignee?.name || f.Assignee, dueAt: f["Due date"], sourceUrl: `https://airtable.com/${enc(secrets.baseId)}/${enc(secrets.targetId)}/${enc(raw.id)}` }); }
  const issueId = provider === "github" ? raw.number : raw.iid;
  return task({ externalId: issueId == null ? "" : String(issueId), title: raw.title, description: provider === "github" ? raw.body : raw.description, status: raw.state === "closed" ? "completed" : "open", assignee: (raw.assignees || []).map((p: any) => p.login || p.name).join(", "), dueAt: raw.due_date, sourceUrl: raw.html_url || raw.web_url });
}
function targetPath(provider: TaskProvider, value: string) {
  if (!value || value.length > 200 || /[\u0000-\u001f]/.test(value)) throw new RevenueError("Enter a valid destination ID.");
  if (provider === "github") {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) || value.split("/").some(part => part === "." || part === "..")) throw new RevenueError("Enter the GitHub repository as owner/name.");
    return value.split("/").map(enc).join("/");
  }
  if (["asana", "monday", "clickup"].includes(provider) && !/^\d+$/.test(value)) throw new RevenueError("Use the numeric project, board or list ID.");
  return enc(value);
}
export async function verifyTaskProvider(provider: TaskProvider, secrets: Secrets): Promise<Partial<ConnectionConfig>> {
  const target = targetPath(provider, secrets.targetId); let result: any;
  if (provider === "notion") {
    try {
      const database = await request(provider, secrets, `/databases/${target}`);
      if (database.data_sources?.length !== 1) throw new RevenueError("This Notion database has multiple data sources. Enter the intended data source ID.");
      secrets.targetId = database.data_sources[0].id;
    } catch (error) { if (!(error instanceof ProviderError) || error.providerStatus !== 404) throw error; }
    result = await request(provider, secrets, `/data_sources/${enc(secrets.targetId)}`);
    const title = Object.entries(result.properties || {}).find(([, property]: any) => property.type === "title");
    if (!title) throw new RevenueError("The Notion data source has no title property. Share a task database with the integration.");
    return { titleProperty: title[0], targetLabel: rich(result.title) || "Notion tasks" };
  }
  if (provider === "monday") { result = (await graph(provider, secrets, "query Verify($ids: [ID!]!) { boards(ids: $ids) { id name } }", { ids: [secrets.targetId] })).boards?.[0]; }
  else if (provider === "linear") result = (await graph(provider, secrets, "query Verify($id: String!) { team(id: $id) { id name } }", { id: secrets.targetId })).team;
  else if (provider === "asana") result = (await request(provider, secrets, `/projects/${target}?opt_fields=name`)).data;
  else if (provider === "clickup") result = await request(provider, secrets, `/list/${target}`);
  else if (provider === "todoist") result = await request(provider, secrets, `/projects/${target}`);
  else if (provider === "trello") {
    result = await request(provider, secrets, `/boards/${target}?fields=name`);
    const destination = await request(provider, secrets, `/lists/${enc(secrets.listId)}?fields=idBoard,closed`);
    if (destination.closed || destination.idBoard !== result.id) throw new RevenueError("Choose an active Trello list belonging to the selected board.");
    secrets.targetId = result.id;
  } else if (provider === "airtable") {
    if (!/^app[A-Za-z0-9]+$/.test(secrets.baseId)) throw new RevenueError("Enter the Airtable base ID beginning with app.");
    const page = await request(provider, secrets, `/${enc(secrets.baseId)}/${target}?maxRecords=1`);
    list(page.records, provider); return { targetLabel: secrets.targetId };
  } else if (provider === "github") { result = await request(provider, secrets, `/repos/${target}`); if (result.has_issues === false) throw new RevenueError("Enable Issues in the selected GitHub repository."); }
  else { result = await request(provider, secrets, `/projects/${target}`); if (result.issues_enabled === false) throw new RevenueError("Enable Issues in the selected GitLab project."); }
  if (!result || !(result.id || result.gid)) throw new RevenueError("The destination could not be verified. Check its ID and access permissions.");
  return { targetLabel: String(result.name || result.full_name || result.path_with_namespace || secrets.targetId).slice(0, 500) };
}
export async function taskProviderPage(provider: TaskProvider, secrets: Secrets, state: SyncCursor) {
  const target = targetPath(provider, secrets.targetId); let rows: any[]; let after: string | undefined;
  const query = new URLSearchParams(); let result: any;
  if (provider === "asana") {
    query.set("limit", "100"); query.set("opt_fields", "name,notes,completed,assignee.name,due_on,due_at,permalink_url"); query.set("completed_since", "1970-01-01T00:00:00Z"); if (state.after) query.set("offset", state.after);
    result = await request(provider, secrets, `/projects/${target}/tasks?${query}`); rows = list(result.data, provider); after = result.next_page?.offset;
  } else if (provider === "notion") {
    result = await request(provider, secrets, `/data_sources/${target}/query`, { page_size: 100, ...(state.after ? { start_cursor: state.after } : {}) }); rows = list(result.results, provider); after = result.has_more ? result.next_cursor : undefined;
    if (result.has_more && !after) throw new RevenueError("Notion omitted its next page cursor.", 502);
  } else if (provider === "trello") { rows = list(await request(provider, secrets, `/boards/${target}/cards/all?fields=name,desc,closed,due,dueComplete,url`), provider); }
  else if (provider === "clickup") {
    const page = Number(state.after || 0); if (!Number.isInteger(page) || page < 0) throw new RevenueError("Invalid ClickUp page.");
    result = await request(provider, secrets, `/list/${target}/task?include_closed=true&subtasks=true&include_timl=true&page=${page}`); rows = list(result.tasks, provider); after = result.last_page === true || (!rows.length) ? undefined : String(page + 1);
  } else if (provider === "monday") {
    const fields = "cursor items { id name url state column_values { id type text } }";
    const data = state.after ? await graph(provider, secrets, `query Tasks($cursor: String!) { next_items_page(limit: 100, cursor: $cursor) { ${fields} } }`, { cursor: state.after })
      : await graph(provider, secrets, `query Tasks($ids: [ID!]!) { boards(ids: $ids) { items_page(limit: 100) { ${fields} } } }`, { ids: [secrets.targetId] });
    result = state.after ? data.next_items_page : data.boards?.[0]?.items_page; rows = list(result?.items, provider); after = result.cursor || undefined;
  } else if (provider === "linear") {
    result = (await graph(provider, secrets, "query Tasks($id: String!, $after: String) { team(id: $id) { issues(first: 100, after: $after) { nodes { id title description url dueDate archivedAt state { type } assignee { name } } pageInfo { hasNextPage endCursor } } } }", { id: secrets.targetId, after: state.after || null })).team?.issues;
    rows = list(result?.nodes, provider); after = result.pageInfo?.hasNextPage ? result.pageInfo.endCursor : undefined;
    if (result.pageInfo?.hasNextPage && !after) throw new RevenueError("Linear omitted its next page cursor.", 502);
  } else if (provider === "todoist") {
    query.set("project_id", secrets.targetId); query.set("limit", "100"); if (state.after) query.set("cursor", state.after);
    result = await request(provider, secrets, `/tasks?${query}`); rows = list(result.results, provider); after = result.next_cursor || undefined;
  } else if (provider === "airtable") {
    query.set("pageSize", "100"); if (state.after) query.set("offset", state.after);
    result = await request(provider, secrets, `/${enc(secrets.baseId)}/${target}?${query}`); rows = list(result.records, provider); after = result.offset || undefined;
  } else {
    const page = Number(state.after || 1); if (!Number.isInteger(page) || page < 1) throw new RevenueError("Invalid issue page.");
    rows = list(await request(provider, secrets, `${provider === "github" ? `/repos/${target}` : `/projects/${target}`}/issues?state=all&per_page=100&page=${page}`), provider);
    // Request one additional page when full; never follow a credential-bearing next-page URL.
    after = rows.length === 100 ? String(page + 1) : undefined;
  }
  if (after && (typeof after !== "string" || after.length > 8192 || after === state.after || (state.pageCount || 0) >= 99)) throw new RevenueError("Task pagination repeated a cursor or exceeded 100 pages. Narrow the destination and retry.");
  return { tasks: rows.filter(raw => provider !== "github" || !raw.pull_request).map(raw => normalizeTask(provider, raw, secrets)), next: { ...state, after, pageCount: (state.pageCount || 0) + 1, complete: !after } };
}
export async function createProviderTask(provider: TaskProvider, secrets: Secrets, config: ConnectionConfig, title: string, description: string) {
  const target = targetPath(provider, secrets.targetId); let raw: any;
  if (provider === "asana") raw = (await request(provider, secrets, "/tasks?opt_fields=name,notes,completed,permalink_url", { data: { name: title, notes: description, projects: [secrets.targetId] } })).data;
  else if (provider === "notion") raw = await request(provider, secrets, "/pages", { parent: { type: "data_source_id", data_source_id: secrets.targetId }, properties: { [config.titleProperty || "Name"]: { title: [{ text: { content: title } }] } }, children: (description.match(/[\s\S]{1,2000}/g) || [""]).map(content => ({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content } }] } })) });
  else if (provider === "trello") raw = await request(provider, secrets, "/cards", { idList: secrets.listId, name: title, desc: description });
  else if (provider === "clickup") raw = await request(provider, secrets, `/list/${target}/task`, { name: title, description });
  else if (provider === "monday") raw = (await graph(provider, secrets, "mutation Create($board: ID!, $name: String!) { create_item(board_id: $board, item_name: $name) { id name url state } }", { board: secrets.targetId, name: title })).create_item;
  else if (provider === "linear") { const result = (await graph(provider, secrets, "mutation Create($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title description url state { type } } } }", { input: { teamId: secrets.targetId, title, description } })).issueCreate; if (!result?.success) throw new RevenueError("Linear did not confirm task creation.", 502); raw = result.issue; }
  else if (provider === "todoist") raw = await request(provider, secrets, "/tasks", { project_id: secrets.targetId, content: title, description });
  else if (provider === "airtable") raw = await request(provider, secrets, `/${enc(secrets.baseId)}/${target}`, { fields: { [secrets.titleField || "Name"]: title, ...(secrets.notesField ? { [secrets.notesField]: description } : {}) } });
  else raw = await request(provider, secrets, `${provider === "github" ? `/repos/${target}` : `/projects/${target}`}/issues`, { title, [provider === "github" ? "body" : "description"]: description });
  return normalizeTask(provider, raw, secrets);
}
