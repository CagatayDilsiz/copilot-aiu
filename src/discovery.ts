import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import type { SessionInfo, WorkspaceYaml } from "./types.js";

// This module is responsible for discovering and querying Copilot sessions stored in the user's home directory under .copilot/session-state.
export type DiscoverOptions = {
  currentOnly?: boolean;
};

const SESSION_STATE_ROOT = path.join(os.homedir(), ".copilot", "session-state");

export function discoverSessions(options: DiscoverOptions = {}): SessionInfo[] {
  if (!fs.existsSync(SESSION_STATE_ROOT)) {
    return [];
  }

  const sessions: SessionInfo[] = [];

  const entries = fs.readdirSync(SESSION_STATE_ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sessionFolder = path.join(SESSION_STATE_ROOT, entry.name);
    const workspaceYamlPath = path.join(sessionFolder, "workspace.yaml");
    const eventsJsonlPath = path.join(sessionFolder, "events.jsonl");

    if (!fs.existsSync(workspaceYamlPath) || !fs.existsSync(eventsJsonlPath)) {
      continue;
    }

    const workspace = readWorkspaceYaml(workspaceYamlPath);
    if (!workspace) {
      continue;
    }

    const relatedFolder = workspace.git_root ?? workspace.cwd ?? "-";

    if (options.currentOnly && !isPathRelated(process.cwd(), relatedFolder)) {
      continue;
    }

    const stat = fs.statSync(eventsJsonlPath);

    sessions.push({
      folderName: entry.name,
      sessionFolder,
      workspaceYamlPath,
      eventsJsonlPath,
      workspace,
      displayName: workspace.name?.trim() || workspace.id?.trim() || entry.name,
      displayId: workspace.id?.trim() || entry.name,
      relatedFolder,
      updatedAt: workspace.updated_at ?? stat.mtime.toISOString(),
      createdAt: workspace.created_at,
    });
  }

  return sessions.sort(compareSessionsByUpdatedDesc);
}

export function findSessionByIdOrName(
  query: string,
  sessions: SessionInfo[],
): {
  status: "not-found" | "single" | "ambiguous";
  matches: SessionInfo[];
} {
  const normalizedQuery = normalize(query);

  const exactMatches = sessions.filter((session) => {
    return (
      normalize(session.displayId) === normalizedQuery ||
      normalize(session.folderName) === normalizedQuery ||
      normalize(session.displayName) === normalizedQuery
    );
  });

  if (exactMatches.length === 1) {
    return { status: "single", matches: exactMatches };
  }

  if (exactMatches.length > 1) {
    return { status: "ambiguous", matches: exactMatches };
  }

  const prefixMatches = sessions.filter((session) => {
    return (
      normalize(session.displayId).startsWith(normalizedQuery) ||
      normalize(session.folderName).startsWith(normalizedQuery) ||
      normalize(session.displayName).startsWith(normalizedQuery)
    );
  });

  if (prefixMatches.length === 1) {
    return { status: "single", matches: prefixMatches };
  }

  if (prefixMatches.length > 1) {
    return { status: "ambiguous", matches: prefixMatches };
  }

  const containsMatches = sessions.filter((session) => {
    return (
      normalize(session.displayId).includes(normalizedQuery) ||
      normalize(session.folderName).includes(normalizedQuery) ||
      normalize(session.displayName).includes(normalizedQuery)
    );
  });

  if (containsMatches.length === 1) {
    return { status: "single", matches: containsMatches };
  }

  if (containsMatches.length > 1) {
    return { status: "ambiguous", matches: containsMatches };
  }

  return { status: "not-found", matches: [] };
}

function readWorkspaceYaml(workspaceYamlPath: string): WorkspaceYaml | undefined {
  const rawText = fs.readFileSync(workspaceYamlPath, "utf8");
  const parsed = YAML.parse(rawText) as unknown;

  if (!isRecord(parsed)) {
    return undefined;
  }

  return parsed as WorkspaceYaml;
}

function compareSessionsByUpdatedDesc(a: SessionInfo, b: SessionInfo): number {
  const aTime = Date.parse(a.updatedAt ?? a.createdAt ?? "");
  const bTime = Date.parse(b.updatedAt ?? b.createdAt ?? "");

  if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
    return bTime - aTime;
  }

  if (!Number.isNaN(aTime)) {
    return -1;
  }

  if (!Number.isNaN(bTime)) {
    return 1;
  }

  return a.displayName.localeCompare(b.displayName);
}

function isPathRelated(currentDirectory: string, targetDirectory: string | undefined): boolean {
  if (!targetDirectory || targetDirectory === "-") {
    return false;
  }

  try {
    const current = ensureTrailingSeparator(path.resolve(currentDirectory)).toLowerCase();
    const target = ensureTrailingSeparator(path.resolve(targetDirectory)).toLowerCase();

    return current.startsWith(target) || target.startsWith(current);
  } catch {
    return false;
  }
}

function ensureTrailingSeparator(value: string): string {
  return value.endsWith(path.sep) ? value : value + path.sep;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}