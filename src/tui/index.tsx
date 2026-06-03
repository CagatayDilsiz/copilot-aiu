import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    const found = discoverSessions({ currentOnly });
    setSessions(found);
  }, [currentOnly]);

  useEffect(() => {
    if (sessions.length > 0 && sessions[selectedIndex]) {
      const session = sessions[selectedIndex];
      if (session) {
        setLoadingUsage(true);
        parseSessionUsage(session.eventsJsonlPath).then((data) => {
          setUsage(data);
          setLoadingUsage(false);
        });
      }
    }
  }, [sessions, selectedIndex]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(sessions.length - 1, prev + 1));
    }
    if (input === "q") {
      process.exit(0);
    }
  });

  const selectedSession = sessions[selectedIndex];

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Copilot AIU - Local Usage Analyzer (Press 'q' to quit)
        </Text>
      </Box>

      <Box flexDirection="row" flexGrow={1}>
        {/* Session List */}
        <Box
          flexDirection="column"
          width="30%"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold underline>
            Sessions ({sessions.length})
          </Text>
          {sessions.map((s, i) => (
            <Text key={s.displayId} {...(i === selectedIndex ? { color: "blue" } : {})}>
              {i === selectedIndex ? "> " : "  "}
              {s.displayName.slice(0, 20)}
            </Text>
          ))}
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
            <Text italic>No sessions found.</Text>
          ) : (
            <>
              <Text bold color="yellow">
                Session: {selectedSession.displayName}
              </Text>
              <Text dimColor>ID: {selectedSession.displayId}</Text>
              <Text dimColor>Folder: {selectedSession.relatedFolder}</Text>

              <Box marginY={1} flexDirection="column">
                {loadingUsage ? (
                  <Text>Loading usage data...</Text>
                ) : usage ? (
                  <>
                    <Box flexDirection="row" justifyContent="space-between">
                      <Box flexDirection="column">
                        <Text bold>Summary</Text>
                        <Text>Credits: {usage.totalCredits.toFixed(4)}</Text>
                        <Text>Est. USD: ${(usage.totalCredits * 0.01).toFixed(4)}</Text>
                        <Text>Runs: {usage.shutdowns.length}</Text>
                      </Box>
                      <Box flexDirection="column">
                        <Text bold>Tokens</Text>
                        <Text>Input: {usage.tokenDetails.input}</Text>
                        <Text>Cached: {usage.tokenDetails.cacheRead}</Text>
                        <Text>Output: {usage.tokenDetails.output}</Text>
                      </Box>
                    </Box>

                    {usage.models.length > 0 && (
                      <Box flexDirection="column" marginTop={1}>
                        <Text bold underline>
                          Models
                        </Text>
                        {usage.models.map((m) => (
                          <Text key={m.model}>
                            - {m.model}: {m.credits.toFixed(3)} credits ({m.requests} reqs)
                          </Text>
                        ))}
                      </Box>
                    )}

                    <Box flexDirection="column" marginTop={1}>
                      <Text bold underline>
                        Recent Runs
                      </Text>
                      {usage.shutdowns.slice(0, 5).map((s, i) => (
                        <Text key={i}>
                          [{s.lineNumber}] {s.timestamp?.slice(11, 19)} - {s.currentModel} - {s.credits.toFixed(3)} cr
                        </Text>
                      ))}
                      {usage.shutdowns.length > 5 && <Text dimColor>... and {usage.shutdowns.length - 5} more</Text>}
                    </Box>
                  </>
                ) : (
                  <Text>Failed to load usage.</Text>
                )}
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export function runTui(options: { currentOnly: boolean }) {
  render(<TuiApp currentOnly={options.currentOnly} />);
}
