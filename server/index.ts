import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { WorkspaceManager } from './workspace/manager';
import { ExecutionRunner } from './execution/runner';
import { DataStore, Conversation, ChatMessage, User } from './storage/store';
import { AIProviderService, DEFAULT_NVIDIA_MODEL } from './providers/ai-provider';
import { AgentOrchestrator, AgentEvent } from './agent/orchestrator';
import { SecurityGuard } from './security/guard';
import { MongoUserStore } from './storage/mongo';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const store = new DataStore();
const settings = store.getSettings();
const workspaceManager = new WorkspaceManager(settings.workspaceDir || config.defaultWorkspaceDir);
const executionRunner = new ExecutionRunner(workspaceManager.getWorkspaceDir());
const orchestrator = new AgentOrchestrator(workspaceManager, executionRunner);

const userStore = config.mongodbUri && config.jwtSecret
  ? new MongoUserStore(config.mongodbUri, config.mongodbDatabase, config.jwtSecret)
  : null;

interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
}

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'NEUTRON AI',
    tagline: 'Intelligence in Action',
    database: userStore && userStore.isConnected() ? 'MongoDB Atlas (Connected)' : 'Local File Store',
    workspace: workspaceManager.getWorkspaceDir(),
    version: '1.0.0',
    time: Date.now(),
  });
});

// User Authentication Endpoints (Supports MongoDB if connected, otherwise seamless local store)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    if (userStore && userStore.isConnected()) {
      const authResult = await userStore.register(name, email, password, role);
      return res.json({ success: true, user: authResult.user, token: authResult.token });
    }

    // Local data store fallback
    const user = store.registerUser(name, email, password, role);
    const token = `ntk_${user.id}_${Date.now()}`;
    return res.json({ success: true, user, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    if (userStore && userStore.isConnected()) {
      const authResult = await userStore.authenticate(email, password);
      if (!authResult) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      return res.json({ success: true, user: authResult.user, token: authResult.token });
    }

    // Local data store fallback
    const authResult = store.authenticateUser(email, password);
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    return res.json({ success: true, user: authResult.user, token: authResult.token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Authentication error.' });
  }
});

app.post('/api/auth/guest', (req: Request, res: Response) => {
  const guestUser = {
    id: `guest_${Date.now()}`,
    name: 'Guest Explorer',
    email: 'guest@neutron.local',
    role: 'AI Engineer',
    avatarColor: 'linear-gradient(135deg, #ff6644 0%, #ff8554 100%)',
    createdAt: Date.now(),
  };
  const token = `ntk_guest_${Date.now()}`;
  res.json({ user: guestUser, token });
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  try {
    if (userStore && userStore.isConnected()) {
      const user = await userStore.getUserFromToken(token);
      if (user) return res.json({ user });
    }

    // Local token verification
    if (token.startsWith('ntk_guest_')) {
      return res.json({
        user: {
          id: 'guest_session',
          name: 'Guest Explorer',
          email: 'guest@neutron.local',
          role: 'AI Engineer',
          avatarColor: 'linear-gradient(135deg, #ff6644 0%, #ff8554 100%)',
          createdAt: Date.now(),
        },
      });
    }

    if (token.startsWith('ntk_')) {
      const parts = token.split('_');
      const userId = parts[1];
      const localUser = store.getUserById(userId);
      if (localUser) {
        return res.json({ user: store.toSafeUser(localUser) });
      }
    }

    // Default demo user fallback for persistent session
    const users = store.getUsers();
    if (users.length > 0) {
      return res.json({ user: store.toSafeUser(users[0]) });
    }

    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Authentication service error.' });
  }
});

// Models and Providers
app.get('/api/models', (req: Request, res: Response) => {
  const providers = AIProviderService.getProviders();
  res.json({ providers });
});

// Settings Management
app.get('/api/settings', (req: Request, res: Response) => {
  const currentSettings = store.getSettings();
  res.json({
    ...currentSettings,
    activeModel: currentSettings.activeModel || config.activeModel || DEFAULT_NVIDIA_MODEL,
    activeProvider: currentSettings.activeProvider || config.activeProvider || 'nvidia',
    workspaceDir: workspaceManager.getWorkspaceDir(),
    apiKeySet: {
      nvidia: !!config.providers.nvidiaApiKey,
    },
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const { workspaceDir, activeProvider, activeModel, nvidiaKey, nvidiaBaseUrl, autoApproveSafe } = req.body;

  if (workspaceDir && typeof workspaceDir === 'string') {
    try {
      workspaceManager.setWorkspaceDir(workspaceDir);
      executionRunner.setWorkspaceDir(workspaceDir);
    } catch (err: any) {
      return res.status(400).json({ error: `Invalid workspace: ${err.message}` });
    }
  }

  if (nvidiaKey) config.providers.nvidiaApiKey = nvidiaKey;
  if (nvidiaBaseUrl) config.providers.nvidiaBaseUrl = nvidiaBaseUrl;
  if (activeModel) config.activeModel = activeModel;
  if (activeProvider) config.activeProvider = activeProvider;

  const updated = store.saveSettings({
    workspaceDir: workspaceManager.getWorkspaceDir(),
    activeProvider: activeProvider || config.activeProvider || 'nvidia',
    activeModel: activeModel || config.activeModel || DEFAULT_NVIDIA_MODEL,
    autoApproveSafe: autoApproveSafe !== undefined ? autoApproveSafe : store.getSettings().autoApproveSafe,
    apiKeySet: {
      nvidia: !!config.providers.nvidiaApiKey,
    },
  });

  res.json({ success: true, settings: updated });
});

// Conversations
app.get('/api/conversations', (req: Request, res: Response) => {
  const list = store.getConversations();
  res.json({ conversations: list });
});

app.get('/api/conversations/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const conv = store.getConversation(id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json({ conversation: conv });
});

app.post('/api/conversations', (req: Request, res: Response) => {
  const conv: Conversation = req.body;
  if (!conv || !conv.id) {
    return res.status(400).json({ error: 'Invalid conversation payload' });
  }
  store.saveConversation(conv);
  res.json({ success: true, conversation: conv });
});

app.delete('/api/conversations/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = store.deleteConversation(id);
  res.json({ success: deleted });
});

// Workspace File Operations
app.get('/api/workspace/tree', async (req: Request, res: Response) => {
  try {
    const tree = await workspaceManager.getFileTree();
    const inspection = await workspaceManager.inspectProject();
    res.json({
      workspaceDir: workspaceManager.getWorkspaceDir(),
      tree,
      inspection,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workspace/file', async (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: 'File path required' });
  }
  try {
    const content = await workspaceManager.readFile(filePath);
    res.json({ path: filePath, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workspace/file', async (req: Request, res: Response) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'path and content required' });
  }
  try {
    const diff = await workspaceManager.editFile(filePath, content);
    res.json({ success: true, diff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workspace/search', async (req: Request, res: Response) => {
  const { query, isRegex } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Search query required' });
  }
  try {
    const results = await workspaceManager.searchFiles(query, !!isRegex);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Command Execution
app.post('/api/execute/run', async (req: Request, res: Response) => {
  const { command, cwd } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'Command required' });
  }
  try {
    const assessment = SecurityGuard.assessCommand(command);
    if (assessment.risk === 'forbidden') {
      return res.status(403).json({ error: `Command forbidden: ${assessment.reason}` });
    }
    const result = await executionRunner.runCommand(command, cwd);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SSE Streaming for Chat and Autonomous Coding Agent
app.post('/api/agent/stream', async (req: Request, res: Response) => {
  const { prompt, mode = 'chat', conversationId, provider, model } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: AgentEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const activeProvider = provider || config.activeProvider || 'nvidia';
  const activeModel = model || config.activeModel || DEFAULT_NVIDIA_MODEL;

  let conversation = conversationId ? store.getConversation(conversationId) : null;
  if (!conversation) {
    conversation = {
      id: conversationId || `conv_${Date.now()}`,
      title: prompt.slice(0, 36) + (prompt.length > 36 ? '...' : ''),
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: activeModel,
      provider: activeProvider,
      messages: [],
    };
  }

  // Add user message
  const userMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'user',
    content: prompt,
    timestamp: Date.now(),
  };
  conversation.messages.push(userMsg);

  try {
    const assistantMessage = await orchestrator.processRequest(
      prompt,
      mode,
      conversation,
      activeProvider,
      activeModel,
      sendEvent
    );

    conversation.messages.push(assistantMessage);
    store.saveConversation(conversation);

    sendEvent({
      type: 'summary',
      data: {
        conversationId: conversation.id,
        message: assistantMessage,
      },
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[NEUTRON API] Error during agent stream:', err);
    sendEvent({
      type: 'error',
      data: { message: err.message || 'Execution error encountered' },
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

const PORT = config.port;
const startServer = async () => {
  if (userStore) {
    try {
      await userStore.connect();
      console.log(`[NEUTRON AI] MongoDB connected (${config.mongodbDatabase}).`);
    } catch (error) {
      console.warn('[NEUTRON AI] MongoDB connection skipped, running with local file storage.');
    }
  } else {
    console.log('[NEUTRON AI] Running with built-in persistent storage.');
  }

  app.listen(PORT, () => {
    console.log(`[NEUTRON AI] Server running on http://localhost:${PORT}`);
    console.log(`[NEUTRON AI] Workspace: ${workspaceManager.getWorkspaceDir()}`);
    console.log(`[NEUTRON AI] Active NVIDIA Model: ${config.activeModel}`);
  });
};

startServer();
