import React, { useRef, useEffect } from 'react';
import {
  Bot,
  FileText,
  Workflow,
  BookOpen,
  Edit2,
  Lightbulb,
  Laptop,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import type { ChatMessage, FileDiff, ModelProvider } from '../types';
import { Header } from './Header';
import { MessageItem } from './MessageItem';
import { PromptComposer } from './PromptComposer';
import { LuminousOrb } from './LuminousOrb';

interface ChatWorkspaceProps {
  conversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  activeModel: string;
  mode: 'agent' | 'chat';
  onModeChange: (mode: 'agent' | 'chat') => void;
  onOpenSettings: () => void;
  activityPanelOpen: boolean;
  onToggleActivityPanel: () => void;
  onSend: (prompt: string, files?: File[]) => void;
  onStop: () => void;
  providers: ModelProvider[];
  onSelectModel: (providerId: string, modelId: string) => void;
  diffs: FileDiff[];
  pendingApproval?: {
    id: string;
    command: string;
    reason: string;
  } | null;
  onApproveCommand?: (approved: boolean) => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  isStreaming,
  activeModel,
  mode,
  onModeChange,
  onOpenSettings,
  activityPanelOpen,
  onToggleActivityPanel,
  onSend,
  onStop,
  providers,
  onSelectModel,
  diffs,
  pendingApproval,
  onApproveCommand,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Auto-scroll on message update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const pillActions = [
    { label: 'Review my project', icon: <Bot size={13} style={{ color: '#ff6644' }} />, prompt: 'Review my current project and point out the most useful improvements.' },
    { label: 'Explain something', icon: <BookOpen size={13} style={{ color: '#8b5cf6' }} />, prompt: 'Explain a topic I am learning in clear, simple steps.' },
    { label: 'Plan a project', icon: <Workflow size={13} style={{ color: '#10b981' }} />, prompt: 'Help me turn an idea into a practical project plan.' },
    { label: 'Draft a report', icon: <FileText size={13} style={{ color: '#f59e0b' }} />, prompt: 'Help me draft a concise report. Ask what it should cover.' },
  ];

  const bottomCards = [
    {
      title: 'Build a feature',
      desc: 'Describe what you want to add to your project.',
      icon: <Edit2 size={16} />,
      cardClass: 'card-1',
      prompt: 'Help me build a feature in my current project.',
    },
    {
      title: 'Understand your code',
      desc: 'Get a clear explanation of a file or codebase.',
      icon: <Lightbulb size={16} />,
      cardClass: 'card-2',
      prompt: 'Explain how my current project is structured and where to start.',
    },
    {
      title: 'Fix a problem',
      desc: 'Share an error or issue and work through it.',
      icon: <Laptop size={16} />,
      cardClass: 'card-3',
      prompt: 'Help me debug an issue in my current project.',
    },
    {
      title: 'Think it through',
      desc: 'Brainstorm options and choose a practical next step.',
      icon: <Calendar size={16} />,
      cardClass: 'card-4',
      prompt: 'Help me brainstorm an idea and decide on a practical next step.',
    },
  ];

  return (
    <main className="neutron-main-workspace">
      {/* Top Header */}
      <Header
        activeModel={activeModel}
        mode={mode}
        onModeChange={onModeChange}
        onOpenSettings={onOpenSettings}
        activityPanelOpen={activityPanelOpen}
        onToggleActivityPanel={onToggleActivityPanel}
        modifiedFilesCount={diffs.length}
      />

      {/* Confirmation Banner for Sensitive Actions */}
      {pendingApproval && (
        <div
          style={{
            background: 'rgba(255, 237, 213, 0.95)',
            borderBottom: '1px solid rgba(251, 146, 60, 0.4)',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: '#ea580c' }} />
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#9a3412' }}>
                Command Approval Required:
              </span>{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#c2410c' }}>
                {pendingApproval.command}
              </code>
              <div style={{ fontSize: '11px', color: '#7c2d12' }}>
                {pendingApproval.reason}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              style={{ padding: '4px 12px', fontSize: '12px' }}
              onClick={() => onApproveCommand && onApproveCommand(false)}
            >
              Reject
            </button>
            <button
              className="btn-primary"
              style={{ padding: '4px 12px', fontSize: '12px' }}
              onClick={() => onApproveCommand && onApproveCommand(true)}
            >
              Approve & Run
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Container */}
      <div className="chat-scroll-container" ref={scrollRef}>
        <div className="chat-inner-width">
          {messages.length === 0 ? (
            <div className="welcome-hero-container">
              {/* Floating 3D Luminous Orb */}
              <LuminousOrb size={92} />

              {/* Greeting */}
              <h1 className="welcome-hero-title">{greeting}</h1>
              <p className="welcome-hero-subtitle">I’m Neutron. What can I help you with today?</p>

              {/* Quick Action Pills Row */}
              <div className="action-pills-row">
                {pillActions.map((pill, idx) => (
                  <button
                    key={idx}
                    className="action-pill-btn"
                    onClick={() => onSend(pill.prompt)}
                  >
                    {pill.icon}
                    <span>{pill.label}</span>
                  </button>
                ))}
              </div>

              {/* The glowing prompt composer */}
              <PromptComposer
                onSend={onSend}
                onStop={onStop}
                isStreaming={isStreaming}
                providers={providers}
                activeModel={activeModel}
                onSelectModel={onSelectModel}
              />

              {/* 4 Bottom Cards */}
              <div className="bottom-cards-grid">
                {bottomCards.map((card, idx) => (
                  <div
                    key={idx}
                    className={`bottom-feature-card ${card.cardClass}`}
                    onClick={() => onSend(card.prompt)}
                  >
                    <div className="card-icon-circle">{card.icon}</div>
                    <div className="card-title">{card.title}</div>
                    <div className="card-description">{card.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <MessageItem
                  key={msg.id || index}
                  message={msg}
                  isStreaming={isStreaming && index === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}

              {/* Bottom prompt composer when messages are present */}
              <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                <PromptComposer
                  onSend={onSend}
                  onStop={onStop}
                  isStreaming={isStreaming}
                  providers={providers}
                  activeModel={activeModel}
                  onSelectModel={onSelectModel}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};
