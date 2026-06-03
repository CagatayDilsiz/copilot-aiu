import os from "node:os";
import type { SessionInfo, SessionUsage } from "../types.js";

export function printSessionList(sessions: SessionInfo[]): void {
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
  console.log("  copilot-aiu show <session-id-or-name>");
  console.log("  copilot-aiu last");
  console.log();
}

export function printSessionDetails(session: SessionInfo): void {
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

export function printSessionUsage(usage: SessionUsage): void {
  console.log("Session usage");
  console.log("-------------");

  if (usage.shutdowns.length === 0) {
    console.log("No session run records found.");
    console.log();
    return;
  }

  console.log(`Session runs:    ${usage.shutdowns.length}`);
  console.log(`Billable runs:   ${usage.billableShutdowns.length}`);
  console.log(`AI Credits:      ${formatCredits(usage.totalCredits)}`);
  console.log(`Estimated USD:   ${formatUsd(usage.totalCredits * 0.01)}`);
  console.log(`API Duration:    ${formatDuration(usage.totalDurationMs)}`);
  console.log();

  console.log("Total token usage:");
  console.log(`  Fresh input:   ${formatNumber(usage.tokenDetails.input)}`);
  console.log(`  Cached input:  ${formatNumber(usage.tokenDetails.cacheRead)}`);
  console.log(
    `  Cache write:   ${formatNumber(usage.tokenDetails.cacheWrite)}`
  );
  console.log(`  Output:        ${formatNumber(usage.tokenDetails.output)}`);
  console.log();

  if (usage.models.length > 0) {
    console.log("Model usage breakdown:");

    const rows = usage.models.map((model) => {
      const share =
        usage.totalCredits > 0 ? (model.credits / usage.totalCredits) * 100 : 0;

      return {
        Model: model.model,
        Credits: formatCredits(model.credits),
        Share: formatPercent(share),
        Req: formatNumber(model.requests),
        "Fresh Input": formatNumber(model.tokenDetails.input),
        "Cached Input": formatNumber(model.tokenDetails.cacheRead),
        "Cache Write": formatNumber(model.tokenDetails.cacheWrite),
        Output: formatNumber(model.tokenDetails.output),
        Reasoning: formatNumber(model.reasoningTokens),
      };
    });

    printTable(rows);
    console.log();
  }

  console.log("Session run details:");

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
      "Note: runs with 0 nanoAIU are shown for history, but excluded from credit totals."
    );
    console.log();
  }
}

export function printJson(data: any): void {
  console.log(JSON.stringify(data, null, 2));
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
    case "Fresh Input":
      return 14;
    case "Cached Input":
      return 14;
    case "Cache Write":
      return 14;
    case "Output":
      return 12;
    case "Reasoning":
      return 12;
    case "Input":
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
