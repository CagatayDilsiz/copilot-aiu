#!/usr/bin/env node

import { Command } from "commander";
import { discoverSessions, findSessionByIdOrName } from "./discovery.js";
import { parseSessionUsage } from "./usage.js";
import {
  printSessionList,
  printSessionDetails,
  printSessionUsage,
  printJson,
} from "./cli/render-text.js";
import { runTui } from "./tui/index.js";
import type { GlobalOptions } from "./options/index.js";

const program = new Command();

program
  .name("copilot-aiu")
  .description(
    "Analyze local GitHub Copilot CLI session usage, AI credits, token details, and mixed-model breakdowns."
  )
  .version("0.0.10");

program
  .command("list", { isDefault: true })
  .description("List Copilot CLI sessions.")
  .option("-c, --current", "Only list sessions related to current directory.")
  .option("-f, --format <format>", "Output format: text, json", "text")
  .action((options: GlobalOptions) => {
    const sessions = discoverSessions({
      currentOnly: Boolean(options.current),
    });

    if (options.format === "json") {
      printJson(sessions);
      return;
    }

    if (sessions.length === 0) {
      console.log(
        options.current
          ? "No sessions found for current directory."
          : "No sessions found."
      );
      return;
    }

    printSessionList(sessions);
  });

program
  .command("show")
  .description("Show session details by id or name.")
  .argument("<idOrName>", "Session id, id prefix, or session name.")
  .option("-c, --current", "Search only sessions related to current directory.")
  .option("-f, --format <format>", "Output format: text, json", "text")
  .action(async (idOrName: string, options: GlobalOptions) => {
    const sessions = discoverSessions({
      currentOnly: Boolean(options.current),
    });
    const result = findSessionByIdOrName(idOrName, sessions);

    if (result.status === "not-found") {
      if (options.format === "json") {
        printJson({ error: "not-found", query: idOrName });
      } else {
        console.log(`No session found for: ${idOrName}`);
      }
      return;
    }

    if (result.status === "ambiguous") {
      if (options.format === "json") {
        printJson({ error: "ambiguous", query: idOrName, matches: result.matches });
      } else {
        console.log(`Ambiguous session query: ${idOrName}`);
        console.log("Use a longer id/name. Matching sessions:");
        console.log();
        printSessionList(result.matches);
      }
      return;
    }

    const [session] = result.matches;

    if (!session) {
      if (options.format === "json") {
        printJson({ error: "not-found", query: idOrName });
      } else {
        console.log(`No session found for: ${idOrName}`);
      }
      return;
    }

    const usage = await parseSessionUsage(session.eventsJsonlPath);

    if (options.format === "json") {
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
  .option("-f, --format <format>", "Output format: text, json", "text")
  .action(async (options: GlobalOptions) => {
    const sessions = discoverSessions({
      currentOnly: Boolean(options.current),
    });

    if (sessions.length === 0) {
      if (options.format === "json") {
        printJson({ error: "no-sessions" });
      } else {
        console.log(
          options.current
            ? "No sessions found for current directory."
            : "No sessions found."
        );
      }
      return;
    }

    const [session] = sessions;

    if (!session) {
      if (options.format === "json") {
        printJson({ error: "no-sessions" });
      } else {
        console.log(
          options.current
            ? "No sessions found for current directory."
            : "No sessions found."
        );
      }
      return;
    }

    const usage = await parseSessionUsage(session.eventsJsonlPath);

    if (options.format === "json") {
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
  .action((options: { current?: boolean }) => {
    runTui({ currentOnly: Boolean(options.current) });
  });

program.parse(process.argv);
