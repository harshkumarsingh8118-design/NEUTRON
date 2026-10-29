import fs from 'fs';
import path from 'path';

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
}

export interface Conversation {
  id: string;
  userId?: string;
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
    steps: Array<{
      id: string;
      title: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      detail?: string;
    }>;
    filesModified: string[];
    commandsRun: Array<{
      command: string;
      exitCode: number | null;
      stdout: string;
      stderr: string;
      durationMs: number;
    }>;
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
  };
}

export class DataStore {
  private baseDir: string;
  private convFile: string;
  private settingsFile: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), '.neutron');
    this.convFile = path.join(this.baseDir, 'conversations.json');
    this.settingsFile = path.join(this.baseDir, 'settings.json');
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.convFile)) {
      fs.writeFileSync(this.convFile, JSON.stringify([], null, 2), 'utf8');
    }
    if (!fs.existsSync(this.settingsFile)) {
      const defaultSettings: AppSettings = {
        activeProvider: 'nvidia',
        activeModel: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        workspaceDir: path.resolve(process.cwd(), 'workspace_sandbox'),
        theme: 'dark',
        autoApproveSafe: true,
        apiKeySet: {
          nvidia: !!process.env.NVIDIA_API_KEY,
        },
      };
      fs.writeFileSync(this.settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
    }
  }

  getAllConversations(): Conversation[] {
    try {
      const data = fs.readFileSync(this.convFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  getConversations(userId?: string): Conversation[] {
    const all = this.getAllConversations();
    if (!userId) return all;
    return all.filter((c) => c.userId === userId);
  }

  saveConversations(conversations: Conversation[]) {
    fs.writeFileSync(this.convFile, JSON.stringify(conversations, null, 2), 'utf8');
  }

  getConversation(id: string, userId?: string): Conversation | undefined {
    const list = this.getConversations(userId);
    return list.find((c) => c.id === id);
  }

  saveConversation(conv: Conversation, userId?: string): void {
    const list = this.getAllConversations();
    if (userId) {
      conv.userId = userId;
    }
    const idx = list.findIndex((c) => c.id === conv.id);
    conv.updatedAt = Date.now();
    if (idx >= 0) {
      list[idx] = conv;
    } else {
      list.unshift(conv);
    }
    this.saveConversations(list);
  }

  deleteConversation(id: string, userId?: string): boolean {
    const list = this.getAllConversations();
    const filtered = list.filter((c) => c.id !== id || (userId && c.userId && c.userId !== userId));
    if (filtered.length !== list.length) {
      this.saveConversations(filtered);
      return true;
    }
    return false;
  }

  getSettings(): AppSettings {
    try {
      const raw = fs.readFileSync(this.settingsFile, 'utf8');
      const parsed: AppSettings = JSON.parse(raw);
      if (!parsed.activeModel || parsed.activeModel.includes('30b-a3b-reasoning')) {
        parsed.activeModel = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
      }
      parsed.activeProvider = parsed.activeProvider || 'nvidia';
      parsed.apiKeySet = { nvidia: !!process.env.NVIDIA_API_KEY };
      return parsed;
    } catch {
      return {
        activeProvider: 'nvidia',
        activeModel: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        workspaceDir: path.resolve(process.cwd(), 'workspace_sandbox'),
        theme: 'dark',
        autoApproveSafe: true,
        apiKeySet: {
          nvidia: !!process.env.NVIDIA_API_KEY,
        },
      };
    }
  }

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(this.settingsFile, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  }

}
