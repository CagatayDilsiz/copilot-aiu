#!/usr/bin/env node

import os from "node:os";
import { Command } from "commander";
import { discoverSessions, findSessionByIdOrName } from "./discovery.js";
import type { SessionInfo, SessionUsage } from "./types.js";
import { parseSessionUsage } from "./usage.js";

const program = new Command();

program
  .name("copilot-aiu")
  .description("Analyze local GitHub Copilot CLI session-state data.")
  .version("0.1.0");

program
  .command("list", { isDefault: true })
  .description("List Copilot CLI sessions.")
  .option("-c, --current", "Only list sessions related to current directory.")
  .action((options: { current?: boolean }) => {
    const sessions = discoverSessions({
      currentOnly: Boolean(options.current),
    });

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
  .action(async (idOrName: string, options: { current?: boolean }) => {
    const sessions = discoverSessions({
      currentOnly: Boolean(options.current),
    });
    const result = findSessionByIdOrName(idOrName, sessions);

    if (result.status === "not-found") {
      console.log(`No session found for: ${idOrName}`);
      return;
    }

    if (result.status === "ambiguous") {
      console.log(`Ambiguous session query: ${idOrName}`);
      console.log("Use a longer id/name. Matching sessions:");
      console.log();
      printSessionList(result.matches);
      return;
    }

    const [session] = result.matches;

    if (!session) {
      console.log(`No session found for: ${idOrName}`);
      return;
    }

    printSessionDetails(session);
    const usage = await parseSessionUsage(session.eventsJsonlPath);
    printSessionUsage(usage);
  });

program
  .command("last")
  .description("Show latest Copilot CLI session details.")
  .option("-c, --current", "Use latest session related to current directory.")
  .action(async (options: { current?: boolean }) => {
    const sessions = discoverSessions({
      currentOnly: Boolean(options.current),
    });

    if (sessions.length === 0) {
      console.log(
        options.current
          ? "No sessions found for current directory."
          : "No sessions found."
      );
      return;
    }

    const [session] = sessions;

    if (!session) {
      console.log(
        options.current
          ? "No sessions found for current directory."
          : "No sessions found."
      );
      return;
    }

    printSessionDetails(session);
    const usage = await parseSessionUsage(session.eventsJsonlPath);
    printSessionUsage(usage);
  });

program.parse(process.argv);

function printSessionList(sessions: SessionInfo[]): void {
  console.log();
  console.log("Copilot Sessions");
  console.log(`Found: ${sessions.length}`);
  console.log();

  const rows = sessions.map((session, index) => ({
    "#": String(index + 1),
    Session: shortId(session.displayId),
    Name: session.displayName,
    Folder: shortenPath(session.relatedFolder),
    Updated: formatDate(session.updatedAt),
  }));

  printTable(rows);
  console.log();
  console.log("Details:");
  console.log("  npm run dev -- show <session-id-or-name>");
  console.log("  npm run dev -- last");
  console.log();
}

function printSessionDetails(session: SessionInfo): void {
  const w = session.workspace;

  console.log();
  console.log(`Session: ${session.displayName}`);
  console.log("-".repeat(Math.max(20, session.displayName.length + 9)));

  console.log(`Session ID:      ${session.displayId}`);
  console.log(`Repository:      ${w.repository ?? "-"}`);
  console.log(`Last Branch:     ${w.branch ?? "-"}`);
  console.log(`Host Type:       ${w.host_type ?? "-"}`);
  console.log(`Client:          ${w.client_name ?? "-"}`);
  console.log(`User Named:      ${formatBoolean(w.user_named)}`);
  console.log(`Created:         ${formatDate(w.created_at)}`);
  console.log(`Updated:         ${formatDate(w.updated_at)}`);
  console.log(`Working Folder:  ${w.cwd ?? "-"}`);
  console.log(`Git Root:        ${w.git_root ?? "-"}`);

  console.log();
}

function printTable(rows: Record<string, string>[]): void {
  const [firstRow] = rows;

  if (!firstRow) {
    return;
  }

  const headers = Object.keys(firstRow);

  const widths = Object.fromEntries(
    headers.map((header) => {
      const maxCellWidth = Math.max(
        header.length,
        ...rows.map((row) => visibleLength(row[header] ?? ""))
      );

      return [header, Math.min(maxCellWidth, maxWidthForColumn(header))];
    })
  ) as Record<string, number>;

  const headerLine = headers
    .map((header) =>
      padRight(header, widths[header] ?? maxWidthForColumn(header))
    )
    .join("  ");

  const separatorLine = headers
    .map((header) => "-".repeat(widths[header] ?? maxWidthForColumn(header)))
    .join("  ");

  console.log(headerLine);
  console.log(separatorLine);

  for (const row of rows) {
    console.log(
      headers
        .map((header) => {
          const width = widths[header] ?? maxWidthForColumn(header);
          return padRight(trimToWidth(row[header] ?? "", width), width);
        })
        .join("  ")
    );
  }
}

function maxWidthForColumn(header: string): number {
  switch (header) {
    case "#":
      return 4;
    case "Session":
      return 10;
    case "Name":
      return 34;
    case "Folder":
      return 64;
    case "Updated":
      return 16;
    case "Model":
      return 22;
    case "Credits":
      return 14;
    case "Share":
      return 8;
    case "Req":
      return 8;
    case "Input":
    case "Cache":
    case "Write":
    case "Output":
    case "Reason":
      return 12;
    case "Line":
      return 6;
    case "Time":
      return 20;
    case "Duration":
      return 12;
    case "Files":
      return 8;
    case "Changes":
      return 12;
    default:
      return 24;
  }
}

function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8);
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBoolean(value: boolean | undefined): string {
  if (value === undefined) {
    return "-";
  }

  return value ? "true" : "false";
}

function shortenPath(value: string): string {
  if (value === "-") {
    return value;
  }

  const home = os.homedir();

  if (value.toLowerCase().startsWith(home.toLowerCase())) {
    return `~${value.slice(home.length)}`;
  }

  return value;
}

function padRight(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - visibleLength(value)));
}

function trimToWidth(value: string, width: number): string {
  if (visibleLength(value) <= width) {
    return value;
  }

  if (width <= 1) {
    return value.slice(0, width);
  }

  return value.slice(0, width - 1) + "…";
}

function visibleLength(value: string): number {
  return value.length;
}

function printSessionUsage(usage: SessionUsage): void {
  console.log("Usage");
  console.log("-----");

  if (usage.shutdowns.length === 0) {
    console.log("No session.shutdown events found.");
    console.log();
    return;
  }

  console.log(`Shutdown events:  ${usage.shutdowns.length}`);
  console.log(`Billable runs:    ${usage.billableShutdowns.length}`);
  console.log(`AI Credits:       ${formatCredits(usage.totalCredits)}`);
  console.log(`Estimated USD:    ${formatUsd(usage.totalCredits * 0.01)}`);
  console.log(`API Duration:     ${formatDuration(usage.totalDurationMs)}`);
  console.log();

  console.log("Aggregate tokens:");
  console.log(`  Input:       ${formatNumber(usage.tokenDetails.input)}`);
  console.log(`  Cache read:  ${formatNumber(usage.tokenDetails.cacheRead)}`);
  console.log(`  Cache write: ${formatNumber(usage.tokenDetails.cacheWrite)}`);
  console.log(`  Output:      ${formatNumber(usage.tokenDetails.output)}`);
  console.log();

  if (usage.models.length > 0) {
    console.log("Model breakdown:");

    const rows = usage.models.map((model) => {
      const share =
        usage.totalCredits > 0 ? (model.credits / usage.totalCredits) * 100 : 0;

      return {
        Model: model.model,
        Credits: formatCredits(model.credits),
        Share: formatPercent(share),
        Req: formatNumber(model.requests),
        Input: formatNumber(model.tokenDetails.input),
        Cache: formatNumber(model.tokenDetails.cacheRead),
        Write: formatNumber(model.tokenDetails.cacheWrite),
        Output: formatNumber(model.tokenDetails.output),
        Reason: formatNumber(model.reasoningTokens),
      };
    });

    printTable(rows);
    console.log();
  }

  console.log("Shutdown runs:");

  const runRows = usage.shutdowns.map((shutdown) => ({
    Line: String(shutdown.lineNumber),
    Time: formatDate(shutdown.timestamp),
    Model: shutdown.currentModel ?? "-",
    Credits: shutdown.nanoAiu > 0 ? formatCredits(shutdown.credits) : "-",
    Duration:
      shutdown.durationMs > 0 ? formatDuration(shutdown.durationMs) : "-",
    Files: formatNumber(shutdown.filesModified.length),
    Changes: `+${shutdown.linesAdded}/-${shutdown.linesRemoved}`,
  }));

  printTable(runRows);
  console.log();

  if (usage.shutdowns.some((shutdown) => shutdown.nanoAiu === 0)) {
    console.log(
      "Note: shutdown events with 0 nanoAIU are shown as non-billable/no-op runs and are not included in totals."
    );
    console.log();
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatPercent(value: number): string {
  return (
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value) + "%"
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "-";
  }

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
