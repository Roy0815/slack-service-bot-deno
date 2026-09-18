/**
 * Reads the local .env file and pushes each variable to Slack
 * via `slack env add <KEY> <VALUE>`.
 *
 * Usage:
 *   node scripts/sync-env-to-slack.js                # sync all vars (asks for confirmation)
 *   node scripts/sync-env-to-slack.js --yes           # skip confirmation prompt
 *   node scripts/sync-env-to-slack.js --dry-run       # show what would happen, no changes
 *   node scripts/sync-env-to-slack.js --only KEY1,KEY2   # only sync specific keys
 *   node scripts/sync-env-to-slack.js --skip KEY1,KEY2   # sync all except these
 *   node scripts/sync-env-to-slack.js --prune         # also remove Slack vars no longer in .env
 *   node scripts/sync-env-to-slack.js --app A0XXXXXXX   # target a specific app ID instead of
 *                                                        # the deployed app resolved from
 *                                                        # .slack/apps.json
 *
 * Deployed app only - do not point this at the local/dev app. For a local
 * app, `slack env set` writes straight back into .env (that IS its store,
 * since `slack run` sources vars directly from .env), so running this
 * script against it turns .env into a read-modify-write loop that mangles
 * the values (observed: escape characters doubling on every run).
 *
 * The Slack CLI also prompts interactively to pick an app whenever more
 * than one app is registered for the team, which breaks this
 * non-interactive script. To avoid that prompt, every `slack env` call is
 * pinned to an explicit app ID via `-a`, resolved from .slack/apps.json
 * unless --app overrides it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { spawnSync } from "node:child_process";

const ENV_PATH = path.resolve(process.cwd(), ".env");
const SLACK_DIR = path.resolve(process.cwd(), ".slack");

function parseArgs(argv) {
  const args = {
    dryRun: false,
    only: null,
    skip: null,
    yes: false,
    prune: false,
    app: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--yes" || arg === "-y")
      args.yes = true;
    else if (arg === "--prune") args.prune = true;
    else if (arg === "--only")
      args.only = argv[++i]
        ?.split(",")
        .map((s) => s.trim());
    else if (arg === "--skip")
      args.skip = argv[++i]
        ?.split(",")
        .map((s) => s.trim());
    else if (arg === "--app" || arg === "-a") args.app = argv[++i];
  }
  return args;
}

/**
 * Resolves the deployed app ID to pin every `slack env` call to, so the
 * Slack CLI never falls back to its interactive app picker. Reads
 * .slack/apps.json, written by the Slack CLI itself when the app was
 * created/installed - unless --app overrides it.
 */
function resolveAppId({ app }) {
  if (app) return app;

  const appsPath = path.join(SLACK_DIR, "apps.json");
  if (!fs.existsSync(appsPath)) return null;

  const { apps, default: defaultTeam } = JSON.parse(
    fs.readFileSync(appsPath, "utf-8"),
  );
  const entry = Object.values(apps ?? {}).find(
    (a) => a.team_domain === defaultTeam,
  ) ?? Object.values(apps ?? {})[0];
  return entry?.app_id ?? null;
}

function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(
        answer.trim().toLowerCase() === "yes" ||
          answer.trim().toLowerCase() === "y",
      );
    });
  });
}

function getRemoteKeys(appId) {
  // Best effort: parses `slack env list` text output to extract variable names.
  // If Slack CLI changes its output format, this parsing may need adjusting -
  // verify with `slack env list` manually if pruning behaves unexpectedly.
  const result = spawnSync("slack", ["env", "list", "-a", appId], {
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    console.error(
      `Could not read remote env vars: ${result.stderr?.trim() || result.error?.message}`,
    );
    return null;
  }

  const lines = result.stdout.split(/\r?\n/);
  const keys = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(name|variable|key)\b/i.test(trimmed)) continue;
    if (/^[-=_]+$/.test(trimmed)) continue;

    const match = trimmed.match(/^([A-Z0-9_]+)\b/);
    if (match) keys.push(match[1]);
  }

  return [...new Set(keys)];
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`No .env file found at ${filePath}`);
    process.exit(1);
  }

  const lines = fs
    .readFileSync(filePath, "utf-8")
    .split(/\r?\n/);
  const vars = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) vars[key] = value;
  }

  return vars;
}

function syncVar(key, value, dryRun, appId) {
  if (dryRun) {
    console.log(`[dry-run] would set ${key}`);
    return { key, ok: true };
  }

  // Passing args as an array (not via shell) avoids the value ending up in
  // shell history. The value goes through --value rather than positionally -
  // otherwise values starting with "-" (e.g. a PEM key's "-----BEGIN...")
  // get misparsed by the CLI as a flag ("bad flag syntax").
  const result = spawnSync(
    "slack",
    ["env", "add", key, "--value", value, "-a", appId],
    {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
    },
  );

  if (result.status !== 0) {
    console.error(
      `✗ ${key} failed: ${result.stderr?.trim() || result.error?.message}`,
    );
    return { key, ok: false };
  }

  console.log(`✓ ${key} synced`);
  return { key, ok: true };
}

function removeVar(key, dryRun, appId) {
  if (dryRun) {
    console.log(`[dry-run] would remove ${key}`);
    return { key, ok: true };
  }

  const result = spawnSync(
    "slack",
    ["env", "remove", key, "-a", appId],
    {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
    },
  );

  if (result.status !== 0) {
    console.error(
      `✗ ${key} could not be removed: ${result.stderr?.trim() || result.error?.message}`,
    );
    return { key, ok: false };
  }

  console.log(`✓ ${key} removed`);
  return { key, ok: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const appId = resolveAppId(args);
  if (!appId) {
    console.error(
      "Could not resolve the deployed app ID from .slack/apps.json. " +
        "Pass one explicitly with --app <APP_ID> (see `slack app list`).",
    );
    process.exit(1);
  }

  console.log(`Target app: ${appId} (deployed)\n`);

  const vars = parseEnvFile(ENV_PATH);

  let keys = Object.keys(vars);
  if (args.only)
    keys = keys.filter((k) => args.only.includes(k));
  if (args.skip)
    keys = keys.filter((k) => !args.skip.includes(k));

  if (keys.length === 0 && !args.prune) {
    console.log("No variables to sync.");
    return;
  }

  // --- Determine what a prune would remove (computed before syncing so the
  // confirmation prompt shows the full picture up front) ---
  let staleKeys = [];
  if (args.prune) {
    const remoteKeys = getRemoteKeys(appId);
    if (remoteKeys === null) {
      console.error(
        "Aborting: could not determine remote variables for pruning.",
      );
      process.exit(1);
    }
    staleKeys = remoteKeys.filter(
      (k) => !Object.keys(vars).includes(k),
    );
  }

  // --- Summary + confirmation ---
  console.log(
    `This will set ${keys.length} variable(s) on Slack:`,
  );
  keys.forEach((k) => console.log(`  + ${k}`));

  if (args.prune) {
    if (staleKeys.length > 0) {
      console.log(
        `\nThis will REMOVE ${staleKeys.length} variable(s) from Slack (not present in local .env):`,
      );
      staleKeys.forEach((k) => console.log(`  - ${k}`));
    } else {
      console.log("\nNo stale variables found to prune.");
    }
  }

  if (!args.dryRun && !args.yes) {
    console.log("");
    const confirmed = await askConfirmation("Proceed?");
    if (!confirmed) {
      console.log("Aborted, no changes made.");
      return;
    }
  }

  console.log(
    `\nSyncing${args.dryRun ? " (dry run)" : ""}...\n`,
  );

  const syncResults = keys.map((key) =>
    syncVar(key, vars[key], args.dryRun, appId),
  );

  let pruneResults = [];
  if (args.prune && staleKeys.length > 0) {
    console.log("");
    pruneResults = staleKeys.map((key) =>
      removeVar(key, args.dryRun, appId),
    );
  }

  const allResults = [...syncResults, ...pruneResults];
  const failed = allResults.filter((r) => !r.ok);

  console.log(
    `\nDone. ${allResults.length - failed.length} succeeded, ${failed.length} failed.`,
  );

  if (failed.length > 0) process.exit(1);
}

main();
