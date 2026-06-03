#!/usr/bin/env node

import { Command, Option } from "commander";
import { discoverSessions, findSessionByIdOrName } from "./discovery.js";
import { parseSessionUsage } from "./usage.js";
import {
  printSessionList,
  printSessionDetails,
  printSessionUsage,
  printJson,
} from "./cli/render-text.js";
import { runTui } from "./tui/index.js";
import { normalizeGlobalOptions } from "./options/index.js";

const program = new Command();

program
  .name("copilot-aiu")
  .description(
    "Analyze local GitHub Copilot CLI session usage, AI credits, token details, and mixed-model breakdowns."
  )
  .version("0.0.10");

program
  .command("list")
  .description("List Copilot CLI sessions.")
  .option("-c, --current", "Only list sessions related to current directory.")
  .addOption(new Option("-f, --format <format>", "Output format").choices(["text", "json"]).default("text"))
  .action((options) => {
    const { current, format } = normalizeGlobalOptions(options);
    const sessions = discoverSessions({ currentOnly: current });

    if (format === "json") {
      printJson(sessions);
      return;
    }

    if (sessions.length === 0) {
      console.log(current ? "No sessions found for current directory." : "No sessions found.");
      return;
    }

    printSessionList(sessions);
  });

program
  .command("show")
  .description("Show session details by id or name.")
  .argument("<idOrName>", "Session id, id prefix, or session name.")
  .option("-c, --current", "Search only sessions related to current directory.")
  .addOption(new Option("-f, --format <format>", "Output format").choices(["text", "json"]).default("text"))
  .action(async (idOrName, options) => {
    const { current, format } = normalizeGlobalOptions(options);
    const sessions = discoverSessions({ currentOnly: current });
    const result = findSessionByIdOrName(idOrName, sessions);

    if (result.status === "not-found") {
      if (format === "json") printJson({ error: "not-found", query: idOrName });
      else console.log(`No session found for: ${idOrName}`);
      return;
    }

    if (result.status === "ambiguous") {
      if (format === "json") printJson({ error: "ambiguous", query: idOrName, matches: result.matches });
      else {
        console.log(`Ambiguous session query: ${idOrName}\nUse a longer id/name. Matching sessions:\n`);
        printSessionList(result.matches);
      }
      return;
    }

    const session = result.matches[0];
    if (!session) return;

    const usage = await parseSessionUsage(session.eventsJsonlPath);
    if (format === "json") {
      printJson({ session, usage });
      return;
    }

    printSessionDetails(session);
    printSessionUsage(usage);
  });

program
  .command("last")
  .description("Show latest Copilot CLI session details.")
  .option("-c, --current", "Use latest session related to current directory.")
  .addOption(new Option("-f, --format <format>", "Output format").choices(["text", "json"]).default("text"))
  .action(async (options) => {
    const { current, format } = normalizeGlobalOptions(options);
    const sessions = discoverSessions({ currentOnly: current });

    if (sessions.length === 0) {
      if (format === "json") printJson({ error: "no-sessions" });
      else console.log(current ? "No sessions found for current directory." : "No sessions found.");
      return;
    }

    const session = sessions[0];
    if (!session) return;

    const usage = await parseSessionUsage(session.eventsJsonlPath);
    if (format === "json") {
      printJson({ session, usage });
      return;
    }

    printSessionDetails(session);
    printSessionUsage(usage);
  });

program
  .command("tui")
  .description("Open Ink-based TUI.")
  .option("-c, --current", "Only show sessions related to current directory.")
  .action((options) => {
    runTui({ currentOnly: Boolean(options.current) });
  });

// Handle default behavior
if (process.argv.length <= 2) {
  const isTTY = process.stdout.isTTY;
  const isCI = process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true";

  if (isTTY && !isCI) {
    runTui({ currentOnly: false });
  } else {
    // Fallback to list for scripts/CI
    program.parse(["node", "copilot-aiu", "list"]);
  }
} else {
  program.parse(process.argv);
}
