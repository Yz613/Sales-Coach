#!/usr/bin/env node
/** Run as a repository administrator. Secret values travel only over stdin. */
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function gh(args, input) {
  try { return execFileSync("gh", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }); }
  catch { throw new Error("GitHub configuration failed. Verify administrator access without logging credentials."); }
}

function main(args = process.argv.slice(2)) {
  const repo = JSON.parse(gh(["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
  const api = (path, payload) => JSON.parse(gh(["api", "--method", "PUT", `repos/${repo}/${path}`, "--input", "-"], JSON.stringify(payload)));
  api("branches/main/protection", {
    required_status_checks: { strict: true, checks: [20, 22].map(version => ({ context: `Test & Build (Node ${version})`, app_id: 15368 })) },
    enforce_admins: true, required_pull_request_reviews: { dismiss_stale_reviews: true, require_code_owner_reviews: false, required_approving_review_count: 1, require_last_push_approval: true },
    restrictions: null, required_conversation_resolution: true, allow_force_pushes: false, allow_deletions: false,
  });
  api("environments/production", { deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } });
  gh(["variable", "set", "REQUIRE_MFA", "--repo", repo, "--body", "true"]);
  console.log("Protected main, restricted production environment, and enabled MFA for the next deployment.");
  const index = args.indexOf("--secrets-file");
  if (index < 0) {
    console.log("Secret migration requires --secrets-file with a private JSON object of secret names and original values. GitHub cannot return stored values.");
    return;
  }
  if (!args[index + 1]) throw new Error("Supply a private JSON secrets file.");
  const values = JSON.parse(fs.readFileSync(args[index + 1], "utf8"));
  if (!values || Array.isArray(values) || typeof values !== "object") throw new Error("Secrets file must contain an object.");
  const workflow = fs.readFileSync(require("node:path").join(__dirname, "../.github/workflows/deploy.yml"), "utf8");
  const allowed = new Set([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(match => match[1]));
  // Validate every entry before uploading or deleting anything.
  for (const [name, value] of Object.entries(values)) {
    if (!allowed.has(name) || typeof value !== "string" || !value.trim()) throw new Error("Secrets file contains an unknown name or empty value.");
  }
  for (const [name, value] of Object.entries(values)) gh(["secret", "set", name, "--repo", repo, "--env", "production"], value);
  const installed = new Set(JSON.parse(gh(["secret", "list", "--repo", repo, "--env", "production", "--json", "name"])).map(row => row.name));
  for (const name of Object.keys(values)) if (!installed.has(name)) throw new Error("Environment secret verification failed; repository copies were preserved.");
  if (args.includes("--remove-repository-copies")) {
    const existing = new Set(JSON.parse(gh(["secret", "list", "--repo", repo, "--json", "name"])).map(row => row.name));
    for (const name of Object.keys(values)) if (existing.has(name)) gh(["secret", "delete", name, "--repo", repo]);
  }
  console.log(`Verified ${Object.keys(values).length} production environment secrets. Secret values were not printed.`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { main };
