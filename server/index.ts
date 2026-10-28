import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { WorkspaceManager } from './workspace/manager';
import { ExecutionRunner } from './execution/runner';
import { DataStore, Conversation, ChatMessage } from './storage/store';
import { AIProviderService } from './providers/ai-provider';
import { AgentOrchestrator, AgentEvent } from './agent/orchestrator';
import { SecurityGuard } from './security/guard';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const store = new DataStore();
const settings = store.getSettings();
const workspaceManager = new WorkspaceManager(settings.workspaceDir || config.defaultWorkspaceDir);
const executionRunner = new ExecutionRunner(workspaceManager.getWorkspaceDir());
const orchestrator = new AgentOrchestrator(workspaceManager, executionRunner);

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'NEUTRON AI',
    tagline: 'Intelligence in Action',
    workspace: workspaceManager.getWorkspaceDir(),
    version: '1.0.0',
    time: Date.now(),
  });
});

// User Authentication Endpoints
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  try {
    const user = store.registerUser(name, email, password, role);
    const authResult = store.authenticateUser(email, password);
    res.json({
      success: true,
      user,
      token: authResult?.token,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const authResult = store.authenticateUser(email, password);
  if (!authResult) {
    return res.status(401).json({ error: 'Invalid email or password. You can use demo@neutron.ai / password123 or create a new account.' });
  }
  res.json({
    success: true,
    user: authResult.user,
    token: authResult.token,
  });
});

app.post('/api/auth/guest', (req: Request, res: Response) => {
  const guestUser = {
    id: `guest_${Date.now()}`,
    name: 'Guest Developer',
    email: 'guest@neutron.local',
    role: 'AI Explorer',
    avatarColor: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
    createdAt: Date.now(),
  };
  res.json({
    success: true,
    user: guestUser,
    token: `ntk_guest_${Date.now()}`,
  });
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
    workspaceDir: workspaceManager.getWorkspaceDir(),
    apiKeySet: {
      nvidia: !!config.providers.nvidiaApiKey,
      gemini: !!config.providers.geminiApiKey,
      openai: !!config.providers.openaiApiKey,
      anthropic: !!config.providers.anthropicApiKey,
      groq: !!config.providers.groqApiKey,
    },
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  const { workspaceDir, activeProvider, activeModel, nvidiaKey, nvidiaBaseUrl, nvidiaModel, geminiKey, openaiKey, anthropicKey, groqKey, autoApproveSafe } = req.body;

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
  if (nvidiaModel) config.providers.nvidiaModel = nvidiaModel;
  if (geminiKey) config.providers.geminiApiKey = geminiKey;
  if (openaiKey) config.providers.openaiApiKey = openaiKey;
  if (anthropicKey) config.providers.anthropicApiKey = anthropicKey;
  if (groqKey) config.providers.groqApiKey = groqKey;
  if (activeProvider) config.activeProvider = activeProvider;
  if (activeModel) config.activeModel = activeModel;

  const updated = store.saveSettings({
    workspaceDir: workspaceManager.getWorkspaceDir(),
    activeProvider: activeProvider || config.activeProvider,
    activeModel: activeModel || config.activeModel,
    autoApproveSafe: autoApproveSafe !== undefined ? autoApproveSafe : store.getSettings().autoApproveSafe,
    apiKeySet: {
      nvidia: !!config.providers.nvidiaApiKey,
      gemini: !!config.providers.geminiApiKey,
      openai: !!config.providers.openaiApiKey,
      anthropic: !!config.providers.anthropicApiKey,
      groq: !!config.providers.groqApiKey,
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
  const conv = store.getConversation(req.params.id);
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
  const deleted = store.deleteConversation(req.params.id);
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
  const { prompt, mode = 'agent', conversationId, provider, model } = req.body;

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

  let conversation = conversationId ? store.getConversation(conversationId) : null;
  if (!conversation) {
    conversation = {
      id: conversationId || `conv_${Date.now()}`,
      title: prompt.slice(0, 36) + (prompt.length > 36 ? '...' : ''),
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: model || config.activeModel,
      provider: provider || config.activeProvider,
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
      provider || conversation.provider,
      model || conversation.model,
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
    sendEvent({
      type: 'error',
      data: { message: err.message || 'Execution error encountered' },
    });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`[NEUTRON AI] Server running on http://localhost:${PORT}`);
  console.log(`[NEUTRON AI] Workspace: ${workspaceManager.getWorkspaceDir()}`);
});
