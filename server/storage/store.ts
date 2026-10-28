import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: string;
  avatarColor: string;
  createdAt: number;
}

export type SafeUser = Omit<User, 'passwordHash' | 'salt'>;

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

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
    gemini: boolean;
    openai: boolean;
    anthropic: boolean;
    groq: boolean;
  };
}

export class DataStore {
  private baseDir: string;
  private convFile: string;
  private settingsFile: string;
  private usersFile: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), '.neutron');
    this.convFile = path.join(this.baseDir, 'conversations.json');
    this.settingsFile = path.join(this.baseDir, 'settings.json');
    this.usersFile = path.join(this.baseDir, 'users.json');
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
        activeProvider: process.env.DEFAULT_PROVIDER || (process.env.NVIDIA_API_KEY ? 'nvidia' : 'gemini'),
        activeModel: process.env.DEFAULT_MODEL || (process.env.NVIDIA_MODEL || (process.env.NVIDIA_API_KEY ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' : 'gemini-2.5-flash')),
        workspaceDir: path.resolve(process.cwd(), 'workspace_sandbox'),
        theme: 'dark',
        autoApproveSafe: true,
        apiKeySet: {
          nvidia: !!process.env.NVIDIA_API_KEY,
          gemini: !!process.env.GEMINI_API_KEY,
          openai: !!process.env.OPENAI_API_KEY,
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          groq: !!process.env.GROQ_API_KEY,
        },
      };
      fs.writeFileSync(this.settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
    }
    if (!fs.existsSync(this.usersFile)) {
      const salt = crypto.randomBytes(16).toString('hex');
      const defaultUsers: User[] = [
        {
          id: 'usr_demo_01',
          name: 'Alex Mercer',
          email: 'demo@neutron.ai',
          passwordHash: hashPassword('password123', salt),
          salt,
          role: 'Senior AI Engineer',
          avatarColor: 'linear-gradient(135deg, #ff6644 0%, #ff8554 100%)',
          createdAt: Date.now(),
        },
      ];
      fs.writeFileSync(this.usersFile, JSON.stringify(defaultUsers, null, 2), 'utf8');
    }
  }

  getConversations(): Conversation[] {
    try {
      const data = fs.readFileSync(this.convFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  saveConversations(conversations: Conversation[]) {
    fs.writeFileSync(this.convFile, JSON.stringify(conversations, null, 2), 'utf8');
  }

  getConversation(id: string): Conversation | undefined {
    const list = this.getConversations();
    return list.find((c) => c.id === id);
  }

  saveConversation(conv: Conversation): void {
    const list = this.getConversations();
    const idx = list.findIndex((c) => c.id === conv.id);
    conv.updatedAt = Date.now();
    if (idx >= 0) {
      list[idx] = conv;
    } else {
      list.unshift(conv);
    }
    this.saveConversations(list);
  }

  deleteConversation(id: string): boolean {
    const list = this.getConversations();
    const filtered = list.filter((c) => c.id !== id);
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
      if (process.env.NVIDIA_API_KEY && (parsed.activeProvider === 'neutron-builtin' || !parsed.activeProvider)) {
        parsed.activeProvider = 'nvidia';
        parsed.activeModel = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
        parsed.apiKeySet = { ...parsed.apiKeySet, nvidia: true };
        this.saveSettings(parsed);
      }
      return parsed;
    } catch {
      return {
        activeProvider: process.env.DEFAULT_PROVIDER || (process.env.NVIDIA_API_KEY ? 'nvidia' : 'gemini'),
        activeModel: process.env.DEFAULT_MODEL || (process.env.NVIDIA_MODEL || (process.env.NVIDIA_API_KEY ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' : 'gemini-2.5-flash')),
        workspaceDir: path.resolve(process.cwd(), 'workspace_sandbox'),
        theme: 'dark',
        autoApproveSafe: true,
        apiKeySet: {
          nvidia: !!process.env.NVIDIA_API_KEY,
          gemini: !!process.env.GEMINI_API_KEY,
          openai: !!process.env.OPENAI_API_KEY,
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          groq: !!process.env.GROQ_API_KEY,
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

  getUsers(): User[] {
    try {
      const raw = fs.readFileSync(this.usersFile, 'utf8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveUsers(users: User[]): void {
    fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2), 'utf8');
  }

  getUserByEmail(email: string): User | undefined {
    const normalized = email.trim().toLowerCase();
    return this.getUsers().find((u) => u.email.toLowerCase() === normalized);
  }

  getUserById(id: string): User | undefined {
    return this.getUsers().find((u) => u.id === id);
  }

  toSafeUser(user: User): SafeUser {
    const { passwordHash, salt, ...safe } = user;
    return safe;
  }

  registerUser(name: string, email: string, password: string, role = 'AI Engineer'): SafeUser {
    const normalized = email.trim().toLowerCase();
    const existing = this.getUserByEmail(normalized);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const colors = [
      'linear-gradient(135deg, #ff6644 0%, #ff8554 100%)',
      'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
      'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    ];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      email: normalized,
      passwordHash,
      salt,
      role: role.trim() || 'AI Engineer',
      avatarColor,
      createdAt: Date.now(),
    };

    const users = this.getUsers();
    users.push(newUser);
    this.saveUsers(users);

    return this.toSafeUser(newUser);
  }

  authenticateUser(email: string, password: string): { user: SafeUser; token: string } | null {
    const user = this.getUserByEmail(email);
    if (!user) {
      return null;
    }
    const hash = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return null;
    }
    const token = `ntk_${user.id}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    return {
      user: this.toSafeUser(user),
      token,
    };
  }
}

