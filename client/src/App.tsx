import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWorkspace } from './components/ChatWorkspace';
import { ActivityPanel } from './components/ActivityPanel';
import { SettingsModal } from './components/SettingsModal';
import { FileViewerModal } from './components/FileViewerModal';
import { AuthPage } from './components/AuthPage';
import { api } from './services/api';
import type {
  Conversation,
  ChatMessage,
  AppSettings,
  ModelProvider,
  TaskStep,
  FileDiff,
  CommandResult,
  FileNode,
  AuthUser,
} from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('neutron_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState<'agent' | 'chat'>('chat');
  const [activityPanelOpen, setActivityPanelOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>({
    activeProvider: 'nvidia',
    activeModel: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    workspaceDir: '',
    theme: 'dark',
    autoApproveSafe: true,
    apiKeySet: {
      nvidia: false,
      gemini: false,
      openai: false,
      anthropic: false,
      groq: false,
    },
  });

  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [workspaceTree, setWorkspaceTree] = useState<FileNode[]>([]);
  const [currentGoal, setCurrentGoal] = useState<string>('');
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);
  const [taskDiffs, setTaskDiffs] = useState<FileDiff[]>([]);
  const [taskCommands, setTaskCommands] = useState<CommandResult[]>([]);
  const [pendingApproval, setPendingApproval] = useState<any | null>(null);

  const abortStreamRef = useRef<(() => void) | null>(null);

  // Initial Data Load
  useEffect(() => {
    loadSettings();
    loadConversations();
    loadModels();
    loadWorkspace();
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      if (e.key === 'Escape') {
        setSettingsModalOpen(false);
        setPreviewFilePath(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.fetchSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadConversations = async () => {
    try {
      const list = await api.fetchConversations();
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        setActiveConversationId(list[0].id);
        setMessages(list[0].messages || []);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadModels = async () => {
    try {
      const list = await api.fetchModels();
      setProviders(list);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const loadWorkspace = async () => {
    try {
      const data = await api.fetchWorkspaceTree();
      setWorkspaceTree(data.tree);
    } catch (err) {
      console.error('Failed to load workspace:', err);
    }
  };

  const handleNewChat = () => {
    const newId = `conv_${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: 'New Chat',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: settings.activeModel,
      provider: settings.activeProvider,
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
    setMessages([]);
    setTaskSteps([]);
    setTaskDiffs([]);
    setTaskCommands([]);
    setCurrentGoal('');
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    const selected = conversations.find((c) => c.id === id);
    if (selected) {
      setMessages(selected.messages || []);
      // Restore task info if available
      const lastAssistantMsg = [...(selected.messages || [])].reverse().find((m) => m.role === 'assistant');
      if (lastAssistantMsg?.plan) {
        setTaskSteps(lastAssistantMsg.plan.steps);
        setCurrentGoal(lastAssistantMsg.plan.goal);
      } else {
        setTaskSteps([]);
        setCurrentGoal('');
      }
    }
  };

  const handleDeleteConversation = async (id: string) => {
    await api.deleteConversation(id);
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    if (activeConversationId === id) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
        setMessages(remaining[0].messages || []);
      } else {
        handleNewChat();
      }
    }
  };

  const handleTogglePin = async (id: string) => {
    const updated = conversations.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c));
    setConversations(updated);
    const target = updated.find((c) => c.id === id);
    if (target) {
      await api.saveConversation(target);
    }
  };

  const handleSend = (prompt: string, files?: File[]) => {
    let convId = activeConversationId;

    if (!convId) {
      convId = `conv_${Date.now()}`;
      const newConv: Conversation = {
        id: convId,
        title: prompt.slice(0, 36),
        pinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: settings.activeModel,
        provider: settings.activeProvider,
        messages: [],
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(convId);
    } else {
      // Update title if it was New Chat
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId && (c.title === 'New Chat' || c.title === 'New Task')
            ? { ...c, title: prompt.slice(0, 36) }
            : c
        )
      );
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      files: files?.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    };

    // Add initial assistant placeholder
    const assistantMsg: ChatMessage = {
      id: `msg_a_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolsCalled: [],
    };

    // Immediately update messages in view!
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    setIsStreaming(true);
    setCurrentGoal(prompt);
    setTaskSteps([]);
    setTaskDiffs([]);
    setTaskCommands([]);

    const abortFn = api.streamAgentRequest(
      {
        prompt,
        mode,
        conversationId: convId,
        provider: settings.activeProvider,
        model: settings.activeModel,
      },
      (event) => {
        handleAgentEvent(event, convId!);
      },
      () => {
        setIsStreaming(false);
        abortStreamRef.current = null;
        loadWorkspace();
      },
      (err) => {
        setIsStreaming(false);
        abortStreamRef.current = null;
        console.error('Streaming error:', err);
      }
    );

    abortStreamRef.current = abortFn;
  };

  const handleAgentEvent = (event: any, convId: string) => {
    const { type, data } = event;

    if (type === 'plan_created') {
      if (data.steps) {
        setTaskSteps(data.steps);
        setActivityPanelOpen(true); // Open activity panel only when a real plan is created!
      }
    } else if (type === 'step_start' || type === 'step_complete' || type === 'step_failed') {
      if (data.step) {
        setTaskSteps((prev) =>
          prev.map((s) => (s.id === data.step.id ? { ...s, ...data.step } : s))
        );
      }
    } else if (type === 'diff_created') {
      if (data.diff) {
        setTaskDiffs((prev) => [...prev, data.diff]);
      }
    } else if (type === 'command_executed') {
      if (data.result) {
        setTaskCommands((prev) => [...prev, data.result]);
      }
    } else if (type === 'approval_required') {
      setPendingApproval(data);
    } else if (type === 'chunk') {
      // Append chunk to the last assistant message with an immutable new object!
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + data.chunk },
          ];
        }
        return prev;
      });
    } else if (type === 'summary') {
      if (data.message) {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          return [...prev.slice(0, -1), data.message];
        });

        // Sync with conversations list and server
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            const updatedMsgs = [...c.messages];
            if (updatedMsgs.length > 0 && updatedMsgs[updatedMsgs.length - 1].role === 'assistant') {
              updatedMsgs[updatedMsgs.length - 1] = data.message;
            } else {
              updatedMsgs.push(data.message);
            }
            const updatedConv = { ...c, messages: updatedMsgs, updatedAt: Date.now() };
            api.saveConversation(updatedConv).catch(console.error);
            return updatedConv;
          })
        );
      }
      loadWorkspace();
    } else if (type === 'error') {
      const errMsg = data?.message || 'An error occurred while processing your request.';
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: `⚠️ **Error Encountered**:\n\n${errMsg}` },
          ];
        }
        return prev;
      });
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleSaveSettings = async (updated: any) => {
    const saved = await api.updateSettings(updated);
    setSettings(saved);
    await loadWorkspace();
    await loadModels();
  };

  const handleSelectModel = async (providerId: string, modelId: string) => {
    setSettings((current) => ({ ...current, activeProvider: providerId, activeModel: modelId }));
    try {
      const saved = await api.updateSettings({ activeProvider: providerId, activeModel: modelId });
      setSettings(saved);
    } catch (err) {
      console.error('Failed to save selected AI model:', err);
      loadSettings();
    }
  };

  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('neutron_user', JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save user session:', e);
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('neutron_user');
    } catch (e) {
      console.error('Failed to clear user session:', e);
    }
  };

  // If user is not logged in, show Sign In / Sign Up Page first!
  if (!currentUser) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="neutron-app">
      {/* Left Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onTogglePin={handleTogglePin}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenWorkspaceModal={() => setSettingsModalOpen(true)}
        workspaceDir={settings.workspaceDir}
        user={currentUser}
        onSignOut={handleSignOut}
      />

      {/* Main Conversation Workspace */}
      <ChatWorkspace
        conversationId={activeConversationId}
        messages={messages}
        isStreaming={isStreaming}
        activeModel={settings.activeModel}
        mode={mode}
        onModeChange={setMode}
        onOpenSettings={() => setSettingsModalOpen(true)}
        activityPanelOpen={activityPanelOpen}
        onToggleActivityPanel={() => setActivityPanelOpen(!activityPanelOpen)}
        onSend={handleSend}
        onStop={handleStop}
        providers={providers}
        onSelectModel={handleSelectModel}
        diffs={taskDiffs}
        pendingApproval={pendingApproval}
        onApproveCommand={() => setPendingApproval(null)}
      />

      {/* Right Activity Panel */}
      <ActivityPanel
        isOpen={activityPanelOpen}
        onClose={() => setActivityPanelOpen(false)}
        currentGoal={currentGoal}
        steps={taskSteps}
        diffs={taskDiffs}
        commands={taskCommands}
        workspaceTree={workspaceTree}
        onSelectFile={(filePath) => setPreviewFilePath(filePath)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        providers={providers}
        onSave={handleSaveSettings}
      />

      {/* File Viewer / Editor Modal */}
      <FileViewerModal
        filePath={previewFilePath}
        onClose={() => setPreviewFilePath(null)}
        onFileSaved={() => loadWorkspace()}
      />
    </div>
  );
};

export default App;
