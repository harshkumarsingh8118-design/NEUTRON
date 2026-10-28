import React from 'react';
import {
  PanelRight,
  Settings2,
} from 'lucide-react';

interface HeaderProps {
  activeModel: string;
  mode: 'agent' | 'chat';
  onModeChange: (mode: 'agent' | 'chat') => void;
  activityPanelOpen: boolean;
  onToggleActivityPanel: () => void;
  onOpenSettings: () => void;
  modifiedFilesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeModel,
  mode,
  onModeChange,
  onOpenSettings,
  activityPanelOpen,
  onToggleActivityPanel,
  modifiedFilesCount = 0,
}) => {
  return (
    <header className="workspace-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 700, letterSpacing: '0.02em' }}>Neutron</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{activeModel || 'Choose an AI model'}</span>
      </div>

      <div role="group" aria-label="Assistant mode" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 9, background: '#f1f3f7' }}>
        <button type="button" onClick={() => onModeChange('chat')} aria-pressed={mode === 'chat'} style={modeButtonStyle(mode === 'chat')}>Assistant</button>
        <button type="button" onClick={() => onModeChange('agent')} aria-pressed={mode === 'agent'} style={modeButtonStyle(mode === 'agent')}>Coding agent</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button type="button" className="action-icon-btn" onClick={onOpenSettings} title="Open Neutron settings" aria-label="Open settings">
          <Settings2 size={16} />
        </button>
        <button
          type="button"
          className={`action-icon-btn ${activityPanelOpen ? 'active' : ''}`}
          onClick={onToggleActivityPanel}
          title={activityPanelOpen ? 'Close Activity' : 'Open Activity'}
          style={{
            background: activityPanelOpen ? '#f0f3f8' : 'transparent',
            padding: '6px 8px',
            borderRadius: '6px',
            gap: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <PanelRight size={16} />
          {modifiedFilesCount > 0 && (
            <span
              style={{
                background: '#ff6644',
                color: '#fff',
                borderRadius: '8px',
                padding: '1px 5px',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {modifiedFilesCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

const modeButtonStyle = (active: boolean): React.CSSProperties => ({
  border: 0,
  borderRadius: 7,
  padding: '6px 10px',
  background: active ? '#fff' : 'transparent',
  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  fontSize: 12,
  fontWeight: active ? 650 : 500,
  cursor: 'pointer',
});
