import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { WorkspaceManager } from './workspace/manager';
import { ExecutionRunner } from './execution/runner';
import type { Conversation, ChatMessage } from './storage/store';
import { AIProviderService, DEFAULT_NVIDIA_MODEL } from './providers/ai-provider';
import { AgentOrchestrator, AgentEvent } from './agent/orchestrator';
import { SecurityGuard } from './security/guard';
import { MongoUserStore } from './storage/mongo';

const app = express();
app.use(cors({ origin: config.clientOrigin || true, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '10mb' }));

const userStore = config.mongodbUri && config.jwtSecret
  ? new MongoUserStore(config.mongodbUri, config.mongodbDatabase, config.jwtSecret)
  : null;

type AuthenticatedRequest = Request & { authenticatedUserId?: string };

/**
 * Multi-Tenant Isolated Workspace & Environment per User
 */
function getUserWorkspaceDir(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const projectRoot = path.resolve(__dirname, '..');
  const baseDir = fs.existsSync(path.resolve(process.cwd(), 'workspace_sandbox'))
    ? path.resolve(process.cwd(), 'workspace_sandbox', 'users', safeId)
    : path.resolve(projectRoot, 'workspace_sandbox', 'users', safeId);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
    const initialReadme = path.join(baseDir, 'README.md');
    if (!fs.existsSync(initialReadme)) {
      fs.writeFileSync(
        initialReadme,
        `# NEUTRON AI Isolated Environment\n\nWelcome to your private NEUTRON AI workspace.\nAll files, tasks, diffs, and execution environments are completely private to your account.\n`,
        'utf8'
      );
    }
  }
  return baseDir;
}

const userEnvMap = new Map<string, {
  workspaceManager: WorkspaceManager;
  executionRunner: ExecutionRunner;
  orchestrator: AgentOrchestrator;
}>();

function getUserEnv(userId: string) {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  let env = userEnvMap.get(safeId);
  if (!env) {
    const userDir = getUserWorkspaceDir(safeId);
    const wm = new WorkspaceManager(userDir);
    const runner = new ExecutionRunner(wm.getWorkspaceDir());
    const orch = new AgentOrchestrator(wm, runner);
    env = { workspaceManager: wm, executionRunner: runner, orchestrator: orch };
    userEnvMap.set(safeId, env);
  }
  return env;
}

function getAuthenticatedUserId(req: Request): string {
  const userId = (req as AuthenticatedRequest).authenticatedUserId;
  if (!userId) throw new Error('Authentication middleware did not provide a user.');
  return userId;
}

async function requireAuthentication(req: AuthenticatedRequest, res: Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!userStore || !userStore.isConnected()) {
    return res.status(503).json({ error: 'Authentication database is unavailable. Check MONGODB_URI and JWT_SECRET.' });
  }
  const user = token ? await userStore.getUserFromToken(token) : null;
  if (!user) return res.status(401).json({ error: 'Sign in is required to access this resource.' });
  req.authenticatedUserId = user.id;
  next();
}

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'NEUTRON AI',
    tagline: 'Intelligence in Action',
    database: userStore && userStore.isConnected() ? 'MongoDB Atlas (Connected)' : 'MongoDB Atlas (Unavailable)',
    workspace: path.resolve(process.cwd(), 'workspace_sandbox'),
    version: '1.0.0',
    time: Date.now(),
  });
});

// User Authentication Endpoints
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    if (!userStore || !userStore.isConnected()) return res.status(503).json({ error: 'Authentication database is unavailable. Check MONGODB_URI and JWT_SECRET.' });
    const authResult = await userStore.register(name, email, password, role);
    return res.json({ success: true, user: authResult.user, token: authResult.token });
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
    if (!userStore || !userStore.isConnected()) return res.status(503).json({ error: 'Authentication database is unavailable. Check MONGODB_URI and JWT_SECRET.' });
    const authResult = await userStore.authenticate(email, password);
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    return res.json({ success: true, user: authResult.user, token: authResult.token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Authentication error.' });
  }
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required.' });
  }

  try {
    if (!userStore || !userStore.isConnected()) return res.status(503).json({ error: 'Authentication database is unavailable. Check MONGODB_URI and JWT_SECRET.' });
    const user = await userStore.getUserFromToken(token);
    if (user) return res.json({ user });
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Authentication service error.' });
  }
});

app.use('/api', requireAuthentication);

// Models and Providers
app.get('/api/models', (req: Request, res: Response) => {
  const providers = AIProviderService.getProviders();
  res.json({ providers });
});

// Settings Management
app.get('/api/settings', async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const userEnv = getUserEnv(userId);
  res.json({
    activeModel: DEFAULT_NVIDIA_MODEL,
    activeProvider: 'nvidia',
    workspaceDir: userEnv.workspaceManager.getWorkspaceDir(),
    theme: 'dark',
    autoApproveSafe: true,
    apiKeySet: {
      nvidia: !!config.providers.nvidiaApiKey,
    },
  });
});

app.post('/api/settings', async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const userEnv = getUserEnv(userId);
  const updated = {
    workspaceDir: userEnv.workspaceManager.getWorkspaceDir(),
    activeProvider: 'nvidia',
    activeModel: DEFAULT_NVIDIA_MODEL,
    theme: 'dark' as const,
    autoApproveSafe: true,
    apiKeySet: {
      nvidia: !!config.providers.nvidiaApiKey,
    },
  };

  res.json({ success: true, settings: updated });
});

// Isolated user conversations. Every query includes the verified user ID.
app.get('/api/conversations', async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  if (!userStore || !userStore.isConnected()) return res.status(503).json({ error: 'Conversation database is unavailable.' });
  const list = await userStore.getUserConversations(userId);
  res.json({ conversations: list });
});

app.get('/api/conversations/:id', async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!userStore || !userStore.isConnected()) return res.status(503).json({ error: 'Conversation database is unavailable.' });
  const conv: Conversation | null = await userStore.getConversation(id, userId);
  if (!conv) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  res.json({ conversation: conv });
});

app.post('/api/conversations', async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const conv: Conversation = req.body;
  if (!conv || !conv.id) {
    return res.status(400).json({ error: 'Invalid conversation payload' });
  }
  conv.userId = userId;
  if (!userStore || !userStore.isConnected()) return res.status(503).json({ error: 'Conversation database is unavailable.' });
  await userStore.saveConversation(conv, userId);
  res.json({ success: true, conversation: conv });
});

app.delete('/api/conversations/:id', async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!userStore || !userStore.isConnected()) return res.status(503).json({ error: 'Conversation database is unavailable.' });
  const deleted = await userStore.deleteConversation(id, userId);
  res.json({ success: deleted });
});

// User-Isolated Workspace File Operations
app.get('/api/workspace/tree', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const userEnv = getUserEnv(userId);
    const tree = await userEnv.workspaceManager.getFileTree();
    const inspection = await userEnv.workspaceManager.inspectProject();
    res.json({
      workspaceDir: userEnv.workspaceManager.getWorkspaceDir(),
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
    const userId = getAuthenticatedUserId(req);
    const userEnv = getUserEnv(userId);
    const content = await userEnv.workspaceManager.readFile(filePath);
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
    const userId = getAuthenticatedUserId(req);
    const userEnv = getUserEnv(userId);
    const diff = await userEnv.workspaceManager.editFile(filePath, content);
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
    const userId = getAuthenticatedUserId(req);
    const userEnv = getUserEnv(userId);
    const results = await userEnv.workspaceManager.searchFiles(query, !!isRegex);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User-Isolated Command Execution
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
    const userId = getAuthenticatedUserId(req);
    const userEnv = getUserEnv(userId);
    const result = await userEnv.executionRunner.runCommand(command, cwd);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// SSE Streaming for Chat and Autonomous Coding Agent (Bound to User & Isolated Workspace)
app.post('/api/agent/stream', async (req: Request, res: Response) => {
  const { prompt, mode = 'chat', conversationId, provider, model } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const userId = getAuthenticatedUserId(req);
  const userEnv = getUserEnv(userId);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: AgentEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const activeProvider = 'nvidia';
  const activeModel = DEFAULT_NVIDIA_MODEL;

  let conversation: Conversation | null = null;
  if (conversationId) {
    if (userStore && userStore.isConnected()) {
      conversation = await userStore.getConversation(conversationId, userId);
    }
  }

  if (!conversation) {
    conversation = {
      id: conversationId || `conv_${Date.now()}`,
      userId,
      title: prompt.slice(0, 36) + (prompt.length > 36 ? '...' : ''),
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: activeModel,
      provider: activeProvider,
      messages: [],
    };
  }

  conversation.userId = userId;

  // Add user message
  const userMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'user',
    content: prompt,
    timestamp: Date.now(),
  };
  conversation.messages.push(userMsg);

  try {
    const assistantMessage = await userEnv.orchestrator.processRequest(
      prompt,
      mode,
      conversation,
      activeProvider,
      activeModel,
      sendEvent
    );

    conversation.messages.push(assistantMessage);
    if (!userStore || !userStore.isConnected()) throw new Error('Conversation database is unavailable.');
      await userStore.saveConversation(conversation, userId);

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
      console.log(`[NEUTRON AI] MongoDB Atlas connected (${config.mongodbDatabase}).`);
    } catch (error) {
      console.error('[NEUTRON AI] MongoDB connection failed. Authentication and user data endpoints will return 503 until the database is available.');
    }
  } else {
    console.error('[NEUTRON AI] MONGODB_URI and JWT_SECRET are required for authentication and user data.');
  }

  app.listen(PORT, () => {
    console.log(`[NEUTRON AI] Server running on http://localhost:${PORT}`);
    console.log(`[NEUTRON AI] Multi-tenant Sandboxes: workspace_sandbox/users/`);
    console.log(`[NEUTRON AI] Active NVIDIA Model: ${config.activeModel}`);
  });
};

startServer();
