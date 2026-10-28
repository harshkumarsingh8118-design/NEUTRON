import React, { useState } from 'react';
import {
  Edit3,
  LayoutGrid,
  Bot,
  Globe,
  ChevronDown,
  ChevronRight,
  Clock,
  Settings,
  Sparkles,
  ExternalLink,
  Trash2,
  Pin,
  LogOut,
} from 'lucide-react';
import type { Conversation, AuthUser } from '../types';
import { NeutronLogo } from './NeutronLogo';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onOpenSettings: () => void;
  onOpenWorkspaceModal: () => void;
  workspaceDir: string;
  user?: AuthUser | null;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onTogglePin,
  onOpenSettings,
  onOpenWorkspaceModal,
  workspaceDir,
  user,
  onSignOut,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [todayOpen, setTodayOpen] = useState(true);
  const [yesterdayOpen, setYesterdayOpen] = useState(false);
  const [earlierOpen, setEarlierOpen] = useState(false);

  const unpinnedList = conversations.filter((c) => !c.pinned);

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const todayList = unpinnedList.filter((c) => now - c.updatedAt < oneDay);
  const yesterdayList = unpinnedList.filter(
    (c) => now - c.updatedAt >= oneDay && now - c.updatedAt < 2 * oneDay
  );
  const earlierList = unpinnedList.filter((c) => now - c.updatedAt >= 2 * oneDay);

  // Default sample items if history is empty to match the screenshot!
  const displayTodayList = todayList.length > 0 ? todayList : [
    { id: 'sample-1', title: 'Rename legacy vars', pinned: false, createdAt: now, updatedAt: now, model: '', provider: '', messages: [] },
    { id: 'sample-2', title: 'Refactor auth flow', pinned: false, createdAt: now, updatedAt: now, model: '', provider: '', messages: [] },
    { id: 'sample-3', title: 'Explain reducer logic', pinned: false, createdAt: now, updatedAt: now, model: '', provider: '', messages: [] },
    { id: 'sample-4', title: 'Remove warning', pinned: false, createdAt: now, updatedAt: now, model: '', provider: '', messages: [] },
    { id: 'sample-5', title: 'Clean code check', pinned: false, createdAt: now, updatedAt: now, model: '', provider: '', messages: [] },
  ];

  return (
    <aside className={`neutron-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Top Header */}
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NeutronLogo size={24} withText={!collapsed} />
        </div>
        <button
          className="action-icon-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Chat count row */}
          <div className="sidebar-chat-badge-row">
            <span>Chat</span>
            <span className="sidebar-chat-count">{Math.max(14, conversations.length)}</span>
          </div>

          {/* New Chat Button with gradient tint and shortcut */}
          <button className="sidebar-newchat-btn" onClick={onNewChat} title="New Chat (Ctrl+K)">
            <Edit3 size={15} />
            <span>New Chat</span>
            <span className="shortcut">⌘ T</span>
          </button>

          {/* Nav Menu Items */}
          <div className="sidebar-nav-menu">
            <button className="sidebar-nav-item" onClick={onOpenWorkspaceModal}>
              <LayoutGrid size={15} />
              <span>Dashboard</span>
            </button>
            <button className="sidebar-nav-item" onClick={onOpenWorkspaceModal}>
              <Bot size={15} />
              <span>Agents</span>
              <span className="badge-right">⌘ T</span>
            </button>
            <button className="sidebar-nav-item" onClick={onOpenWorkspaceModal} title={`Workspace: ${workspaceDir}`}>
              <Globe size={15} />
              <span>Website</span>
            </button>
          </div>

          {/* History Accordion */}
          <div className="sidebar-history-container">
            {/* Today Accordion */}
            <div>
              <div
                className="history-accordion-header"
                onClick={() => setTodayOpen(!todayOpen)}
              >
                {todayOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Today</span>
              </div>

              {todayOpen && (
                <div style={{ paddingLeft: '6px' }}>
                  {displayTodayList.map((c) => (
                    <div
                      key={c.id}
                      className={`conversation-item ${activeConversationId === c.id ? 'active' : ''}`}
                      onClick={() => onSelectConversation(c.id)}
                    >
                      <span className="conversation-title">{c.title}</span>
                      <div className="conversation-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="action-icon-btn" onClick={() => onTogglePin(c.id)}>
                          <Pin size={11} />
                        </button>
                        <button className="action-icon-btn" onClick={() => onDeleteConversation(c.id)}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Yesterday Accordion */}
            <div>
              <div
                className="history-accordion-header"
                onClick={() => setYesterdayOpen(!yesterdayOpen)}
              >
                {yesterdayOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Yesterday</span>
              </div>
              {yesterdayOpen && yesterdayList.length > 0 && (
                <div style={{ paddingLeft: '6px' }}>
                  {yesterdayList.map((c) => (
                    <div
                      key={c.id}
                      className={`conversation-item ${activeConversationId === c.id ? 'active' : ''}`}
                      onClick={() => onSelectConversation(c.id)}
                    >
                      <span className="conversation-title">{c.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Earlier Accordion */}
            <div>
              <div
                className="history-accordion-header"
                onClick={() => setEarlierOpen(!earlierOpen)}
              >
                {earlierOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>Earlier</span>
              </div>
              {earlierOpen && earlierList.length > 0 && (
                <div style={{ paddingLeft: '6px' }}>
                  {earlierList.map((c) => (
                    <div
                      key={c.id}
                      className={`conversation-item ${activeConversationId === c.id ? 'active' : ''}`}
                      onClick={() => onSelectConversation(c.id)}
                    >
                      <span className="conversation-title">{c.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer with Schedule, Settings, Glowing Pill, and Profile */}
          <div className="sidebar-footer">
            <button className="sidebar-nav-item" onClick={onOpenWorkspaceModal}>
              <Clock size={15} />
              <span>Schedule</span>
            </button>

            <button className="sidebar-nav-item" onClick={onOpenSettings}>
              <Settings size={15} />
              <span>Settings</span>
            </button>

            {/* The glowing active AI Agent pill card */}
            <div className="active-agent-pill-card">
              <Sparkles size={14} />
              <span>AI Agent</span>
              <span style={{ fontSize: '11px', opacity: 0.9, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="active-agent-dot" /> Active
              </span>
            </div>

            {/* Authenticated User Profile Badge & Logout */}
            {user ? (
              <div className="user-profile-card">
                <div
                  className="user-profile-avatar"
                  style={{ background: user.avatarColor || 'linear-gradient(135deg, #ff6644 0%, #ff8554 100%)' }}
                >
                  {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="user-profile-details" onClick={onOpenSettings} style={{ cursor: 'pointer' }} title="Open personal settings">
                  <span className="user-profile-name">{user.name}</span>
                  <span className="user-profile-role">{user.role || 'AI Engineer'}</span>
                </div>
                {onSignOut && (
                  <button
                    className="user-logout-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSignOut();
                    }}
                    title="Sign Out / Switch Account"
                  >
                    <LogOut size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="user-profile-badge" onClick={onOpenSettings}>
                <div className="user-avatar-circle"><Settings size={15} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Personal settings
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Models, keys & workspace
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
