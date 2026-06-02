export type WorkspaceYaml = {
  id?: string;
  cwd?: string;
  git_root?: string | undefined;
  repository?: string | undefined;
  host_type?: string | undefined;
  branch?: string | undefined;
  name?: string | undefined;
  client_name?: string | undefined;
  user_named?: boolean | undefined;
  summary_count?: number | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
  remote_steerable?: boolean | undefined;
  mc_task_id?: string | undefined;
  mc_session_id?: string | undefined;
  mc_last_event_id?: string | undefined;
};

export type SessionInfo = {
  folderName: string;
  sessionFolder: string;
  workspaceYamlPath: string;
  eventsJsonlPath: string;
  workspace: WorkspaceYaml;
  displayName: string;
  displayId: string;
  relatedFolder: string;
  updatedAt?: string | undefined;
  createdAt?: string | undefined;
};


export type TokenDetails = {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
};

export type ModelBreakdown = {
  model: string;
  requests: number;
  nanoAiu: number;
  credits: number;
  tokenDetails: TokenDetails;
  reasoningTokens: number;
};

export type ShutdownUsage = {
  lineNumber: number;
  id?: string | undefined;
  timestamp?: string | undefined;
  shutdownType?: string | undefined;
  currentModel?: string | undefined;
  nanoAiu: number;
  credits: number;
  durationMs: number;
  tokenDetails: TokenDetails;
  models: ModelBreakdown[];
  linesAdded: number;
  linesRemoved: number;
  filesModified: string[];
};

export type SessionUsage = {
  shutdowns: ShutdownUsage[];
  billableShutdowns: ShutdownUsage[];
  totalNanoAiu: number;
  totalCredits: number;
  totalDurationMs: number;
  tokenDetails: TokenDetails;
  models: ModelBreakdown[];
};