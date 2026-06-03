import React, { useState, useEffect, useCallback } from "react";
import { render, Box, Text, useInput } from "ink";
import { discoverSessions } from "../discovery.js";
import { parseSessionUsage } from "../usage.js";
import type { SessionInfo, SessionUsage } from "../types.js";

type TuiProps = {
  currentOnly: boolean;
};

const TuiApp: React.FC<TuiProps> = ({ currentOnly }) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [usage, setUsage] = useState<SessionUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(() => {
    const found = discoverSessions({ currentOnly });
    setSessions(found);
    if (found.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= found.length) {
      setSelectedIndex(found.length - 1);
    }
  }, [currentOnly, selectedIndex]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (sessions.length === 0) {
      setUsage(null);
      return;
    }

    const session = sessions[selectedIndex];
    if (!session) return;

    let isMounted = true;
    setLoadingUsage(true);
    setUsage(null); // Reset usage on selection change
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
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (sessions.length > 0 ? Math.min(sessions.length - 1, prev + 1) : 0));
    }
    if (input === "r") {
      refreshSessions();
    }
    if (input === "q") {
      process.exit(0);
    }
  });

  const selectedSession = sessions.length > 0 ? sessions[selectedIndex] : null;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Copilot AIU - Local Usage Analyzer
        </Text>
      </Box>
      <Box flexDirection="row" flexGrow={1} minHeight={15}>
        {/* Session List */}
        <Box
          flexDirection="column"
          width="30%"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
        >
          <Box borderStyle="single" borderColor="gray" borderBottom={true} borderTop={false} borderLeft={false} borderRight={false} marginBottom={1}>
            <Text bold>Sessions ({sessions.length})</Text>
          </Box>
          {sessions.length === 0 ? (
            <Text dimColor italic>No sessions</Text>
          ) : (
            sessions.map((s, i) => (
              <Text key={s.displayId} wrap="truncate-end" {...(i === selectedIndex ? { color: "blue", bold: true } : {})}>
                {i === selectedIndex ? "> " : "  "}
                {s.displayName}
              </Text>
            ))
          )}
        </Box>
        {/* Details Area */}
        <Box
          flexDirection="column"
          width="70%"
          borderStyle="round"
          borderColor="blue"
          paddingX={1}
        >
          {!selectedSession ? (
            <Box justifyContent="center" alignItems="center" flexGrow={1}>
              <Text italic dimColor>No session selected.</Text>
            </Box>
          ) : (
            <>
              <Text bold color="yellow">
                Session: {selectedSession.displayName}
              </Text>
              <Text dimColor>ID: {selectedSession.displayId}</Text>
              <Text dimColor>Folder: {selectedSession.relatedFolder}</Text>
              <Box marginY={1} flexDirection="column" flexGrow={1}>
                {loadingUsage ? (
                  <Text color="gray">Loading usage data...</Text>
                ) : error ? (
                  <Text color="red">Error: {error}</Text>
                ) : usage ? (
                  <>
                    <Box flexDirection="row" justifyContent="space-between">
                      <Box flexDirection="column">
                        <Text bold underline>Summary</Text>
                        <Text>Credits: {usage.totalCredits.toFixed(4)}</Text>
                        <Text>Est. USD: ${(usage.totalCredits * 0.01).toFixed(4)}</Text>
                        <Text>Runs: {usage.shutdowns.length}</Text>
                      </Box>
                      <Box flexDirection="column">
                        <Text bold underline>Tokens</Text>
                        <Text>Input: {usage.tokenDetails.input}</Text>
                        <Text>Cached: {usage.tokenDetails.cacheRead}</Text>
                        <Text>Output: {usage.tokenDetails.output}</Text>
                      </Box>
                    </Box>
                    {usage.models.length > 0 && (
                      <Box flexDirection="column" marginTop={1}>
                        <Text bold underline>Models</Text>
                        {usage.models.map((m) => (
                          <Text key={m.model}>
                            - {m.model}: {m.credits.toFixed(3)} credits ({m.requests} reqs)
                          </Text>
                        ))}
                      </Box>
                    )}
                    <Box flexDirection="column" marginTop={1}>
                      <Text bold underline>Recent Runs</Text>
                      {usage.shutdowns.slice(0, 5).map((s, i) => (
                        <Text key={i} wrap="truncate-end">
                          [{s.lineNumber}] {s.timestamp?.slice(11, 19)} - {s.currentModel} - {s.credits.toFixed(3)} cr
                        </Text>
                      ))}
                      {usage.shutdowns.length > 5 && <Text dimColor>... and {usage.shutdowns.length - 5} more</Text>}
                    </Box>
                  </>
                ) : (
                  <Text dimColor>No usage data available.</Text>
                )}
              </Box>
            </>
          )}
        </Box>
      </Box>
      {/* Help Footer */}
      <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="gray" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false}>
        <Text dimColor>
          <Text bold color="white">↑/↓</Text> Navigate  |  <Text bold color="white">r</Text> Refresh  |  <Text bold color="white">q</Text> Quit
        </Text>
      </Box>
    </Box>
  );
};

export function runTui(options: { currentOnly: boolean }) {
  render(<TuiApp currentOnly={options.currentOnly} />);
}
