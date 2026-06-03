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
        if (sessions.length > 0) setMode("session-detail");
      }
    } else if (mode === "session-detail") {
      if (key.upArrow) {
        setSelectedRunIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
        if (usage) setSelectedRunIndex((prev) => Math.min(usage.shutdowns.length - 1, prev + 1));
      }
      if (key.return) {
        if (usage && usage.shutdowns[selectedRunIndex]) setMode("run-detail");
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
    if (input === "c") setCurrentOnly((prev) => !prev);
    if (input === "?") setMode("help");
  });

  const selectedSession = sessions.length > 0 ? sessions[selectedIndex] : null;

  const renderDashboard = () => (
    <Box flexDirection="row" flexGrow={1}>
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
                <Text color={theme.dim}>Loading...</Text>
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
                    <Text bold color={theme.primary}>Recent 5 Runs</Text>
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
              ) : null}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );

  const renderSessionDetail = () => {
    if (!selectedSession || !usage) return null;
    const w = selectedSession.workspace;
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={2} flexGrow={1}>
        <Text bold color={theme.secondary} underline>Session Details: {selectedSession.displayName}</Text>
        <Box flexDirection="row" marginTop={1}>
          <Box flexDirection="column" width="50%">
            <Text bold color={theme.primary}>Metadata</Text>
            <Text>Session ID: {selectedSession.displayId}</Text>
            <Text>Repository: {w.repository ?? "-"}</Text>
            <Text>Branch:     {w.branch ?? "-"}</Text>
            <Text>Host Type:  {w.host_type ?? "-"}</Text>
            <Text>Client:     {w.client_name ?? "-"}</Text>
            <Text>Created:    {w.created_at?.slice(0,16).replace('T', ' ')}</Text>
            <Text>Updated:    {w.updated_at?.slice(0,16).replace('T', ' ')}</Text>
          </Box>
          <Box flexDirection="column" width="50%">
            <Text bold color={theme.primary}>Aggregated Usage</Text>
            <Text>AI Credits:    {usage.totalCredits.toFixed(6)}</Text>
            <Text>Billable Runs: {usage.billableShutdowns.length}</Text>
            <Text>API Duration:  {(usage.totalDurationMs / 1000).toFixed(1)}s</Text>
            <Text>Reasoning Tok: {usage.models.reduce((acc, m) => acc + m.reasoningTokens, 0)}</Text>
            <Text>Files Mod:    {usage.shutdowns.reduce((acc, s) => acc + s.filesModified.length, 0)}</Text>
            <Text>Changes:      +{usage.shutdowns.reduce((acc, s) => acc + s.linesAdded, 0)} / -{usage.shutdowns.reduce((acc, s) => acc + s.linesRemoved, 0)}</Text>
          </Box>
        </Box>

        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          <Text bold color={theme.primary}>All Runs (Select and Enter for details)</Text>
          <Box flexDirection="column" borderStyle="single" borderColor={theme.dim} paddingX={1}>
            {usage.shutdowns.map((s, i) => (
              <Text key={i} {...(i === selectedRunIndex ? { color: theme.highlight as any } : {})}>
                {i === selectedRunIndex ? "> " : "  "}
                [{s.lineNumber}] {s.timestamp?.slice(11, 19)} | {s.currentModel?.padEnd(20)} | {s.credits.toFixed(3)} cr
              </Text>
            ))}
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.dim}>Esc back to Dashboard | Enter for Run Detail</Text>
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
        <Box flexDirection="column" marginTop={1}>
          <Text><Text bold color={theme.primary}>Timestamp:</Text> {run.timestamp}</Text>
          <Text><Text bold color={theme.primary}>Model:</Text>     {run.currentModel}</Text>
          <Text><Text bold color={theme.primary}>Credits:</Text>   {run.credits.toFixed(6)}</Text>
          <Text><Text bold color={theme.primary}>Duration:</Text>  {run.durationMs}ms</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.primary}>Tokens</Text>
          <Text>Input: {run.tokenDetails.input} | Cached: {run.tokenDetails.cacheRead} | Cache Write: {run.tokenDetails.cacheWrite} | Output: {run.tokenDetails.output}</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text bold color={theme.primary}>Changes</Text>
          <Text>Lines Added: {run.linesAdded} | Lines Removed: {run.linesRemoved}</Text>
          <Text>Files Modified ({run.filesModified.length}):</Text>
          {run.filesModified.map((f, i) => (
            <Text key={i} color={theme.dim}>  - {f}</Text>
          ))}
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
