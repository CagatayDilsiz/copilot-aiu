import React, { useState, useEffect, useCallback, useMemo } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { discoverSessions } from "../discovery.js";
import { parseSessionUsage } from "../usage.js";
import type { SessionInfo, SessionUsage, ShutdownUsage } from "../types.js";
import { theme } from "./theme.js";

type ScreenMode = "dashboard" | "session-detail" | "run-detail" | "help";

type TuiProps = {
  initialCurrentOnly: boolean;
};

const TuiApp: React.FC<TuiProps> = ({ initialCurrentOnly }) => {
  const { exit } = useApp();
  const [currentOnly, setCurrentOnly] = useState(initialCurrentOnly);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [usage, setUsage] = useState<SessionUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ScreenMode>("dashboard");
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);

  const refreshSessions = useCallback(() => {
    const found = discoverSessions({ currentOnly });
    setSessions(found);
    if (found.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= found.length) {
      setSelectedIndex(Math.max(0, found.length - 1));
    }
  }, [currentOnly, selectedIndex]);

  useEffect(() => {
    refreshSessions();
  }, [currentOnly]);

  useEffect(() => {
    if (sessions.length === 0) {
      setUsage(null);
      return;
    }

    const session = sessions[selectedIndex];
    if (!session) return;

    let isMounted = true;
    setLoadingUsage(true);
    setUsage(null);
    setError(null);
    setSelectedRunIndex(0); // Reset run index on session change

    parseSessionUsage(session.eventsJsonlPath)
      .then((data) => {
        if (isMounted) {
          setUsage(data);
          setLoadingUsage(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoadingUsage(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [sessions, selectedIndex]);

  useInput((input, key) => {
    if (mode === "dashboard") {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
        setSelectedIndex((prev) => (sessions.length > 0 ? Math.min(sessions.length - 1, prev + 1) : 0));
      }
      if (key.return) {
        // Block Enter if usage is not ready
        if (sessions.length > 0 && usage && !loadingUsage && !error) {
          setMode("session-detail");
        }
      }
    } else if (mode === "session-detail") {
      if (key.upArrow) {
        if (usage && usage.shutdowns.length > 0) {
          setSelectedRunIndex((prev) => Math.max(0, prev - 1));
        }
      }
      if (key.downArrow) {
        if (usage && usage.shutdowns.length > 0) {
          setSelectedRunIndex((prev) => Math.min(usage.shutdowns.length - 1, prev + 1));
        }
      }
      if (key.return) {
        if (usage && usage.shutdowns.length > 0) {
          setMode("run-detail");
        }
      }
      if (key.escape) {
        setMode("dashboard");
      }
    } else if (mode === "run-detail") {
      if (key.escape) {
        setMode("session-detail");
      }
    } else if (mode === "help") {
      if (key.escape || input === "?") setMode("dashboard");
    }

    if (input === "q") exit();
    if (input === "r") refreshSessions();
    if (input === "c") {
      setCurrentOnly((prev) => !prev);
      setSelectedIndex(0);
    }
    if (input === "?") setMode("help");
  });

  const selectedSession = sessions.length > 0 ? sessions[selectedIndex] : null;

  const renderDashboard = () => (
    <Box flexDirection="row" flexGrow={1}>
      {/* Left List */}
      <Box flexDirection="column" width="30%" borderStyle="round" borderColor={theme.border} paddingX={1}>
        <Box borderStyle="single" borderColor={theme.border} borderBottom={true} borderTop={false} borderLeft={false} borderRight={false} marginBottom={1}>
          <Text bold color={theme.header}>Sessions ({sessions.length})</Text>
        </Box>
        {sessions.length === 0 ? (
          <Text italic color={theme.dim}>No sessions</Text>
        ) : (
          sessions.map((s, i) => (
            <Text key={s.displayId} wrap="truncate-end" {...(i === selectedIndex ? { color: theme.highlight as any, bold: true } : {})}>
              {i === selectedIndex ? "> " : "  "}
              {s.displayName}
            </Text>
          ))
        )}
      </Box>

      {/* Right Summary */}
      <Box flexDirection="column" width="70%" borderStyle="round" borderColor={theme.border} paddingX={1}>
        {!selectedSession ? (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <Text italic color={theme.dim}>No session selected.</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text bold color={theme.secondary}>Summary: {selectedSession.displayName}</Text>
            <Box marginY={1} flexDirection="column">
              {loadingUsage ? (
                <Text color={theme.dim}>Loading usage data...</Text>
              ) : error ? (
                <Text color={theme.error}>Error: {error}</Text>
              ) : usage ? (
                <>
                  <Box flexDirection="row" justifyContent="space-between">
                    <Box flexDirection="column">
                      <Text bold color={theme.primary}>Usage Stats</Text>
                      <Text>Credits: {usage.totalCredits.toFixed(4)}</Text>
                      <Text>Est. USD: ${(usage.totalCredits * 0.01).toFixed(4)}</Text>
                      <Text>Total Runs: {usage.shutdowns.length}</Text>
                      <Text>Billable: {usage.billableShutdowns.length}</Text>
                    </Box>
                    <Box flexDirection="column">
                      <Text bold color={theme.primary}>Tokens</Text>
                      <Text>Input: {usage.tokenDetails.input}</Text>
                      <Text>Cached: {usage.tokenDetails.cacheRead}</Text>
                      <Text>Cache Write: {usage.tokenDetails.cacheWrite}</Text>
                      <Text>Output: {usage.tokenDetails.output}</Text>
                    </Box>
                  </Box>

                  {usage.models.length > 0 && (
                    <Box flexDirection="column" marginTop={1}>
                      <Text bold color={theme.primary}>Top Models</Text>
                      {usage.models.slice(0, 3).map(m => (
                        <Text key={m.model}>- {m.model} ({m.requests} reqs)</Text>
                      ))}
                    </Box>
                  )}

                  <Box flexDirection="column" marginTop={1}>
                    <Text bold color={theme.primary}>Recent Runs</Text>
                    {usage.shutdowns.slice(0, 5).map((s, i) => (
                      <Text key={i} wrap="truncate-end">
                        [{s.lineNumber}] {s.timestamp?.slice(11, 19)} - {s.currentModel} ({s.credits.toFixed(3)} cr)
                      </Text>
                    ))}
                  </Box>
                  <Box marginTop={1}>
                    <Text color={theme.dim}>Press Enter for full details</Text>
                  </Box>
                </>
              ) : (
                <Text color={theme.dim}>Usage data not available.</Text>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );

  const renderSessionDetail = () => {
    if (!selectedSession || !usage) return null;
    const w = selectedSession.workspace;

    // Run list paging
    const windowSize = 8;
    const start = Math.max(0, Math.min(selectedRunIndex - Math.floor(windowSize / 2), usage.shutdowns.length - windowSize));
    const visibleRuns = usage.shutdowns.slice(start, start + windowSize);

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={2} flexGrow={1}>
        <Text bold color={theme.secondary} underline>Session Details: {selectedSession.displayName}</Text>

        <Box flexDirection="row" marginTop={1}>
          <Box flexDirection="column" width="50%">
            <Text bold color={theme.primary}>Metadata</Text>
            <Text>ID:      {selectedSession.displayId}</Text>
            <Text>Repo:    {w.repository ?? "-"}</Text>
            <Text>Branch:  {w.branch ?? "-"}</Text>
            <Text>Host:    {w.host_type ?? "-"}</Text>
            <Text>Client:  {w.client_name ?? "-"}</Text>
            <Text>Named:   {w.user_named ? "true" : "false"}</Text>
            <Text>Created: {w.created_at?.slice(0,10) ?? "-"}</Text>
            <Text>Updated: {w.updated_at?.slice(0,10) ?? "-"}</Text>
            <Text>Folder:  {w.cwd ?? "-"}</Text>
            <Text>GitRoot: {w.git_root ?? "-"}</Text>
          </Box>
          <Box flexDirection="column" width="50%">
            <Text bold color={theme.primary}>Aggregated Usage</Text>
            <Text>Credits:    {usage.totalCredits.toFixed(6)}</Text>
            <Text>Est. USD:   ${(usage.totalCredits * 0.01).toFixed(4)}</Text>
            <Text>Total Runs: {usage.shutdowns.length}</Text>
            <Text>Billable:   {usage.billableShutdowns.length}</Text>
            <Text>Duration:   {(usage.totalDurationMs / 1000).toFixed(1)}s</Text>
            <Text>Input Tok:  {usage.tokenDetails.input}</Text>
            <Text>Cached Tok: {usage.tokenDetails.cacheRead}</Text>
            <Text>Write Tok:  {usage.tokenDetails.cacheWrite}</Text>
            <Text>Output Tok: {usage.tokenDetails.output}</Text>
            <Text>Reason Tok: {usage.models.reduce((acc, m) => acc + m.reasoningTokens, 0)}</Text>
          </Box>
        </Box>

        {/* Model Breakdown */}
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.primary}>Model Breakdown</Text>
          <Box flexDirection="column" borderStyle="single" borderColor={theme.dim} paddingX={1}>
            {usage.models.map((m, i) => {
               const share = usage.totalCredits > 0 ? (m.credits / usage.totalCredits) * 100 : 0;
               return (
                 <Text key={i} wrap="truncate-end">
                   {m.model.padEnd(20)} | {m.credits.toFixed(4)} cr ({share.toFixed(1)}%) | {m.requests} reqs | In: {m.tokenDetails.input} (C:{m.tokenDetails.cacheRead}, W:{m.tokenDetails.cacheWrite}) | Out: {m.tokenDetails.output} (R:{m.reasoningTokens})
                 </Text>
               );
            })}
          </Box>
        </Box>

        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          <Text bold color={theme.primary}>All Runs ({usage.shutdowns.length})</Text>
          <Box flexDirection="column" borderStyle="single" borderColor={theme.dim} paddingX={1}>
            {usage.shutdowns.length === 0 ? (
              <Text italic color={theme.dim}>No runs available.</Text>
            ) : (
              <>
                {start > 0 && <Text color={theme.dim}>  ... (scroll up)</Text>}
                {visibleRuns.map((s, i) => {
                  const realIndex = start + i;
                  return (
                    <Text key={realIndex} {...(realIndex === selectedRunIndex ? { color: theme.highlight as any, bold: true } : {})}>
                      {realIndex === selectedRunIndex ? "> " : "  "}
                      [{s.lineNumber.toString().padStart(3)}] {s.timestamp?.slice(11, 19)} | {s.currentModel?.padEnd(20)} | {s.credits.toFixed(3)} cr | {s.durationMs}ms
                    </Text>
                  );
                })}
                {start + windowSize < usage.shutdowns.length && <Text color={theme.dim}>  ... (scroll down)</Text>}
              </>
            )}
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color={theme.dim}>Esc back | Enter for Run Detail</Text>
        </Box>
      </Box>
    );
  };

  const renderRunDetail = () => {
    const run = usage?.shutdowns[selectedRunIndex];
    if (!run) return null;
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={2} flexGrow={1}>
        <Text bold color={theme.secondary} underline>Run Detail: Line {run.lineNumber}</Text>
        <Box flexDirection="row" marginTop={1}>
          <Box flexDirection="column" width="50%">
            <Text bold color={theme.primary}>Metadata</Text>
            <Text>Time:     {run.timestamp}</Text>
            <Text>Model:    {run.currentModel}</Text>
            <Text>Credits:  {run.credits.toFixed(6)}</Text>
            <Text>Duration: {run.durationMs}ms</Text>
          </Box>
          <Box flexDirection="column" width="50%">
            <Text bold color={theme.primary}>Tokens</Text>
            <Text>Input:    {run.tokenDetails.input}</Text>
            <Text>Cached:   {run.tokenDetails.cacheRead}</Text>
            <Text>Write:    {run.tokenDetails.cacheWrite}</Text>
            <Text>Output:   {run.tokenDetails.output}</Text>
          </Box>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.primary}>Changes</Text>
          <Text>Files Modified: {run.filesModified.length}</Text>
          <Text>Lines Added:    {run.linesAdded}</Text>
          <Text>Lines Removed:  {run.linesRemoved}</Text>
          {run.filesModified.length > 0 && (
             <Box flexDirection="column" borderStyle="single" borderColor={theme.dim} paddingX={1} marginTop={1}>
               {run.filesModified.slice(0, 10).map((f, i) => (
                 <Text key={i} color={theme.dim}>  - {f}</Text>
               ))}
               {run.filesModified.length > 10 && <Text color={theme.dim}>  ... and {run.filesModified.length - 10} more</Text>}
             </Box>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color={theme.dim}>Esc back to Session Details</Text>
        </Box>
      </Box>
    );
  };

  const renderHelp = () => (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={2} flexGrow={1} justifyContent="center" alignItems="center">
      <Text bold color={theme.header}>Keyboard Shortcuts</Text>
      <Box flexDirection="column" marginTop={1}>
        <Text><Text bold color={theme.highlight}>↑/↓</Text>       Navigate List</Text>
        <Text><Text bold color={theme.highlight}>Enter</Text>     Open Detail / Select</Text>
        <Text><Text bold color={theme.highlight}>Esc</Text>       Back / Exit Screen</Text>
        <Text><Text bold color={theme.highlight}>r</Text>         Refresh Sessions</Text>
        <Text><Text bold color={theme.highlight}>c</Text>         Toggle Current Folder Only ({currentOnly ? "ON" : "OFF"})</Text>
        <Text><Text bold color={theme.highlight}>q</Text>         Quit Application</Text>
        <Text><Text bold color={theme.highlight}>?</Text>         Toggle Help Screen</Text>
      </Box>
      <Box marginTop={2}>
        <Text color={theme.dim}>Press Esc or ? to close</Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1} minHeight={20}>
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={theme.header}>Copilot AIU - {currentOnly ? "Current Directory" : "All Sessions"}</Text>
        <Text color={theme.dim}>{mode.toUpperCase()} MODE</Text>
      </Box>

      {mode === "dashboard" && renderDashboard()}
      {mode === "session-detail" && renderSessionDetail()}
      {mode === "run-detail" && renderRunDetail()}
      {mode === "help" && renderHelp()}

      <Box marginTop={1} paddingX={1} borderStyle="single" borderColor={theme.border} borderTop={true} borderBottom={false} borderLeft={false} borderRight={false}>
        <Text dimColor>
          <Text bold color={theme.text}>↑/↓</Text> Nav | <Text bold color={theme.text}>Enter</Text> Detail | <Text bold color={theme.text}>Esc</Text> Back | <Text bold color={theme.text}>c</Text> Current | <Text bold color={theme.text}>r</Text> Refresh | <Text bold color={theme.text}>?</Text> Help | <Text bold color={theme.text}>q</Text> Quit
        </Text>
      </Box>
    </Box>
  );
};

export function runTui(options: { currentOnly: boolean }) {
  render(<TuiApp initialCurrentOnly={options.currentOnly} />);
}
