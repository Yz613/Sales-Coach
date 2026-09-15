#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
console.log("\x1b[1m\x1b[34m%s\x1b[0m", "🚀 Setting up Sales Coach AI...\n");

// 1. Check Node version
const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor < 20) {
  console.error(`\x1b[31mError: Node.js 20 or later is required (detected v${process.version}).\x1b[0m`);
  process.exit(1);
}
console.log(`\x1b[32m✓\x1b[0m Node.js v${process.version} detected.`);

// 2. Create .env.local if not present
const envLocal = path.join(ROOT, ".env.local");
const envExample = path.join(ROOT, ".env.example");
if (!fs.existsSync(envLocal) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envLocal);
  console.log("\x1b[32m✓\x1b[0m Created .env.local from .env.example");
} else if (fs.existsSync(envLocal)) {
  console.log("\x1b[32m✓\x1b[0m .env.local already exists.");
}

// 3. Seed Database
console.log("\n📦 Initializing and seeding local SQLite database (sales_coach.db)...");
try {
  execSync("npm run db:seed", { cwd: ROOT, stdio: "inherit" });
  console.log("\x1b[32m✓\x1b[0m Database seeded successfully with sample reps, calls, and rubrics.");
} catch (err) {
  console.error("\x1b[31mFailed to seed database.\x1b[0m", err.message);
  process.exit(1);
}

console.log("\n\x1b[1m\x1b[32m%s\x1b[0m", "✨ Setup complete! Run `npm run dev` to start Sales Coach.\n");
