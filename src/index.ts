import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";

type WorkspaceYaml = {
  id?: string;
  cwd?: string;
  git_root?: string;
  repository?: string;
  host_type?: string;
  branch?: string;
  name?: string;
  client_name?: string;
  user_named?: boolean;
  summary_count?: number;
  created_at?: string;
  updated_at?: string;
  remote_steerable?: boolean;
  mc_task_id?: string;
  mc_session_id?: string;
  mc_last_event_id?: string;
};

type SessionRow = {
  index: number;
  sessionFolderName: string;
  sessionFolder: string;
  workspaceYamlPath: string;
  workspace: WorkspaceYaml;
};

const sessionStateRoot = path.join(os.homedir(), ".copilot", "session-state");

if (!fs.existsSync(sessionStateRoot)) {
  console.error(`session-state folder not found: ${sessionStateRoot}`);
  process.exit(1);
}

const sessions = readWorkspaceSessions(sessionStateRoot);

if (sessions.length === 0) {
  console.log("No workspace.yaml files found under session-state.");
  process.exit(0);
}

printSessionTable(sessions);

function readWorkspaceSessions(root: string): SessionRow[] {
  const result: SessionRow[] = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sessionFolder = path.join(root, entry.name);
    const workspaceYamlPath = path.join(sessionFolder, "workspace.yaml");

    if (!fs.existsSync(workspaceYamlPath)) {
      continue;
    }

    const rawText = fs.readFileSync(workspaceYamlPath, "utf8");
    const parsed = YAML.parse(rawText) as unknown;

    if (!isRecord(parsed)) {
      continue;
    }

    const workspace = parsed as WorkspaceYaml;

    result.push({
      index: 0,
      sessionFolderName: entry.name,
      sessionFolder,
      workspaceYamlPath,
      workspace,
    });
  }

  return result
    .sort((a, b) => {
      const aTime = Date.parse(a.workspace.updated_at ?? a.workspace.created_at ?? "");
      const bTime = Date.parse(b.workspace.updated_at ?? b.workspace.created_at ?? "");

      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
        return bTime - aTime;
      }

      return a.sessionFolderName.localeCompare(b.sessionFolderName);
    })
    .map((session, index) => ({
      ...session,
      index: index + 1,
    }));
}

function printSessionTable(sessions: SessionRow[]): void {
  console.log();
  console.log("Copilot Sessions");
  console.log(`Found: ${sessions.length}`);
  console.log();

  const rows = sessions.map((session) => {
    const w = session.workspace;

    return {
      "#": String(session.index),
      "Session": shortId(w.id ?? session.sessionFolderName),
      "Name": w.name ?? "-",
      "Repository": w.repository ?? "-",
      "Branch": w.branch ?? "-",
      "Client": w.client_name ?? "-",
      "Updated": formatDate(w.updated_at ?? w.created_at),
      "Path": shortenPath(w.git_root ?? w.cwd ?? "-"),
    };
  });

  printTable(rows);
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
        ...rows.map((row) => visibleLength(row[header] ?? "")),
      );

      return [header, Math.min(maxCellWidth, maxWidthForColumn(header))];
    }),
  ) as Record<string, number>;

  const headerLine = headers
    .map((header) => padRight(header, widths[header] ?? maxWidthForColumn(header)))
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
        .join("  "),
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
      return 28;
    case "Repository":
      return 30;
    case "Branch":
      return 20;
    case "Client":
      return 16;
    case "Updated":
      return 16;
    case "Path":
      return 48;
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

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}