import fs from "node:fs";
import readline from "node:readline";
import type {
  ModelBreakdown,
  SessionUsage,
  ShutdownUsage,
  TokenDetails,
} from "./types.js";

const NANO_AIU_PER_CREDIT = 1_000_000_000;

export async function parseSessionUsage(
  eventsJsonlPath: string
): Promise<SessionUsage> {
  const shutdowns: ShutdownUsage[] = [];

  const stream = fs.createReadStream(eventsJsonlPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;

    const shutdownTypePattern = /"type"\s*:\s*"session\.shutdown"/;

    if (!shutdownTypePattern.test(line)) {
      continue;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (!isRecord(parsed) || parsed.type !== "session.shutdown") {
      continue;
    }

    const shutdown = parseShutdownEvent(parsed, lineNumber);
    shutdowns.push(shutdown);
  }

  const billableShutdowns = shutdowns.filter(
    (shutdown) => shutdown.nanoAiu > 0
  );

  return {
    shutdowns,
    billableShutdowns,
    totalNanoAiu: sum(billableShutdowns, (x) => x.nanoAiu),
    totalCredits: sum(billableShutdowns, (x) => x.credits),
    totalDurationMs: sum(billableShutdowns, (x) => x.durationMs),
    tokenDetails: sumTokenDetails(billableShutdowns.map((x) => x.tokenDetails)),
    models: groupModels(billableShutdowns.flatMap((x) => x.models)),
  };
}

function parseShutdownEvent(
  event: Record<string, unknown>,
  lineNumber: number
): ShutdownUsage {
  const data = getRecord(event.data);

  const tokenDetails = parseTokenDetails(getRecord(data.tokenDetails));
  const codeChanges = getRecord(data.codeChanges);

  return {
    lineNumber,
    id: getString(event.id),
    timestamp: getString(event.timestamp),
    shutdownType: getString(data.shutdownType),
    currentModel: getString(data.currentModel),
    nanoAiu: getNumber(data.totalNanoAiu),
    credits: getNumber(data.totalNanoAiu) / NANO_AIU_PER_CREDIT,
    durationMs: getNumber(data.totalApiDurationMs),
    tokenDetails,
    models: parseModelMetrics(getRecord(data.modelMetrics)),
    linesAdded: getNumber(codeChanges.linesAdded),
    linesRemoved: getNumber(codeChanges.linesRemoved),
    filesModified: getStringArray(codeChanges.filesModified),
  };
}

function parseModelMetrics(
  modelMetrics: Record<string, unknown>
): ModelBreakdown[] {
  const result: ModelBreakdown[] = [];

  for (const [modelName, rawMetric] of Object.entries(modelMetrics)) {
    if (!isRecord(rawMetric)) {
      continue;
    }

    const requests = getRecord(rawMetric.requests);
    const usage = getRecord(rawMetric.usage);
    const tokenDetailsRaw = getRecord(rawMetric.tokenDetails);

    const nanoAiu = getNumber(rawMetric.totalNanoAiu);

    result.push({
      model: modelName,
      requests: getNumber(requests.count),
      nanoAiu,
      credits: nanoAiu / NANO_AIU_PER_CREDIT,
      tokenDetails:
        Object.keys(tokenDetailsRaw).length > 0
          ? parseTokenDetails(tokenDetailsRaw)
          : parseTokenDetailsFromUsage(usage),
      reasoningTokens: getNumber(usage.reasoningTokens),
    });
  }

  return result.sort((a, b) => b.nanoAiu - a.nanoAiu);
}

function parseTokenDetails(raw: Record<string, unknown>): TokenDetails {
  return {
    input: readTokenCount(raw.input),
    cacheRead: readTokenCount(raw.cache_read),
    cacheWrite: readTokenCount(raw.cache_write),
    output: readTokenCount(raw.output),
  };
}

function parseTokenDetailsFromUsage(
  usage: Record<string, unknown>
): TokenDetails {
  const cacheRead = getNumber(usage.cacheReadTokens);
  const cacheWrite = getNumber(usage.cacheWriteTokens);
  const totalInput = getNumber(usage.inputTokens);

  return {
    input: Math.max(0, totalInput - cacheRead - cacheWrite),
    cacheRead,
    cacheWrite,
    output: getNumber(usage.outputTokens),
  };
}

function readTokenCount(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (isRecord(value)) {
    return getNumber(value.tokenCount);
  }

  return 0;
}

function groupModels(models: ModelBreakdown[]): ModelBreakdown[] {
  const map = new Map<string, ModelBreakdown>();

  for (const model of models) {
    const existing = map.get(model.model);

    if (!existing) {
      map.set(model.model, {
        ...model,
        tokenDetails: { ...model.tokenDetails },
      });
      continue;
    }

    existing.requests += model.requests;
    existing.nanoAiu += model.nanoAiu;
    existing.credits += model.credits;
    existing.reasoningTokens += model.reasoningTokens;
    existing.tokenDetails = sumTokenDetails([
      existing.tokenDetails,
      model.tokenDetails,
    ]);
  }

  return [...map.values()].sort((a, b) => b.nanoAiu - a.nanoAiu);
}

function sumTokenDetails(items: TokenDetails[]): TokenDetails {
  return {
    input: sum(items, (x) => x.input),
    cacheRead: sum(items, (x) => x.cacheRead),
    cacheWrite: sum(items, (x) => x.cacheWrite),
    output: sum(items, (x) => x.output),
  };
}

function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function getRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
