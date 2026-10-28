import type {
  Conversation,
  AppSettings,
  ModelProvider,
  FileNode,
  ProjectInspection,
  FileDiff,
  CommandResult,
  AuthUser,
} from '../types';

export const api = {
  async login(payload: { email: string; password: string }): Promise<{ user: AuthUser; token: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to sign in');
    return data;
  },

  async register(payload: { name: string; email: string; password: string; role?: string }): Promise<{ user: AuthUser; token: string }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to register account');
    return data;
  },

  async guestLogin(): Promise<{ user: AuthUser; token: string }> {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initialize guest session');
    return data;
  },

  async fetchConversations(): Promise<Conversation[]> {
    const res = await fetch('/api/conversations');
    if (!res.ok) throw new Error('Failed to fetch conversations');
    const data = await res.json();
    return data.conversations || [];
  },

  async fetchConversation(id: string): Promise<Conversation> {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch conversation');
    const data = await res.json();
    return data.conversation;
  },

  async saveConversation(conv: Conversation): Promise<void> {
    await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conv),
    });
  },

  async deleteConversation(id: string): Promise<void> {
    await fetch(`/api/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  async fetchWorkspaceTree(): Promise<{
    workspaceDir: string;
    tree: FileNode[];
    inspection: ProjectInspection;
  }> {
    const res = await fetch('/api/workspace/tree');
    if (!res.ok) throw new Error('Failed to fetch workspace tree');
    return res.json();
  },

  async fetchFileContent(filePath: string): Promise<string> {
    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error('Failed to fetch file');
    const data = await res.json();
    return data.content;
  },

  async saveFileContent(filePath: string, content: string): Promise<FileDiff> {
    const res = await fetch('/api/workspace/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    if (!res.ok) throw new Error('Failed to save file');
    const data = await res.json();
    return data.diff;
  },

  async searchFiles(query: string, isRegex = false) {
    const res = await fetch('/api/workspace/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, isRegex }),
    });
    if (!res.ok) throw new Error('Failed to search');
    return res.json();
  },

  async runCommand(command: string, cwd?: string): Promise<CommandResult> {
    const res = await fetch('/api/execute/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Command failed');
    }
    const data = await res.json();
    return data.result;
  },

  async fetchSettings(): Promise<AppSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(payload: any): Promise<AppSettings> {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    const data = await res.json();
    return data.settings;
  },

  async fetchModels(): Promise<ModelProvider[]> {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('Failed to fetch models');
    const data = await res.json();
    return data.providers || [];
  },

  /**
   * Streams agent execution events via SSE
   */
  streamAgentRequest(
    payload: {
      prompt: string;
      mode: 'agent' | 'chat';
      conversationId: string;
      provider?: string;
      model?: string;
    },
    onEvent: (event: any) => void,
    onDone: () => void,
    onError: (err: any) => void,
    signal?: AbortSignal
  ): () => void {
    const controller = new AbortController();
    const activeSignal = signal || controller.signal;

    (async () => {
      try {
        const response = await fetch('/api/agent/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: activeSignal,
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No readable stream');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              onDone();
              return;
            }
            try {
              const event = JSON.parse(dataStr);
              onEvent(event);
            } catch {
              // ignore partial json
            }
          }
        }

        onDone();
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[NEUTRON] Generation aborted by user.');
          onDone();
        } else {
          onError(err);
        }
      }
    })();

    return () => controller.abort();
  },
};
