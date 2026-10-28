export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  files?: Array<{ name: string; size: number; type: string }>;
  toolsCalled?: Array<{
    toolName: string;
    params: any;
    status: 'pending' | 'running' | 'success' | 'error';
    output?: any;
    diff?: any;
  }>;
  plan?: {
    goal: string;
    steps: Array<{
      id: string;
      title: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      detail?: string;
    }>;
  };
  diffs?: FileDiff[];
  commands?: CommandResult[];
}

export interface TaskStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  detail?: string;
}

export interface FileDiff {
  filePath: string;
  originalContent: string;
  newContent: string;
  diffText: string;
  additions: number;
  deletions: number;
}

export interface CommandResult {
  command: string;
  cwd?: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut?: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
}

export interface ProjectInspection {
  primaryLanguage: string;
  frameworks: string[];
  filesCount: number;
  hasPackageJson: boolean;
  hasRequirementsTxt: boolean;
  hasPomOrGradle: boolean;
  summary: string;
}

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  model: string;
  provider: string;
  messages: ChatMessage[];
  currentTask?: {
    id: string;
    goal: string;
    status: 'idle' | 'running' | 'completed' | 'failed' | 'waiting_approval';
    steps: TaskStep[];
    filesModified: string[];
    commandsRun: CommandResult[];
  };
}

export interface AppSettings {
  activeProvider: string;
  activeModel: string;
  workspaceDir: string;
  theme: 'dark';
  autoApproveSafe: boolean;
  apiKeySet: {
    nvidia: boolean;
    gemini: boolean;
    openai: boolean;
    anthropic: boolean;
    groq: boolean;
  };
}

export interface ModelProvider {
  id: string;
  name: string;
  isConfigured: boolean;
  models: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  createdAt: number;
}

