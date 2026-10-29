import React, { useState } from 'react';
import { X, Key, FolderCode, Sliders } from 'lucide-react';
import type { AppSettings, ModelProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  providers: ModelProvider[];
  onSave: (updated: any) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [workspaceDir, setWorkspaceDir] = useState(settings.workspaceDir);
  const [nvidiaKey, setNvidiaKey] = useState('');
  const [autoApproveSafe, setAutoApproveSafe] = useState(settings.autoApproveSafe);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        workspaceDir,
        nvidiaKey: nvidiaKey.trim() || undefined,
        autoApproveSafe,
      });
      onClose();
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontWeight: 700, fontSize: '15px' }}>NEUTRON Settings</span>
          </div>
          <button className="action-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Workspace Directory Setting */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderCode size={14} />
              <span>Workspace Directory Root</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={workspaceDir}
              onChange={(e) => setWorkspaceDir(e.target.value)}
              placeholder="e.g. C:\Users\project or ./workspace_sandbox"
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              All file reads, writes, and sandboxed commands are strictly confined within this root.
            </span>
          </div>

          {/* API Keys Configuration */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} />
              <span>NVIDIA NIM API Key (Stored locally on server)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>NVIDIA NIM API Key {settings.apiKeySet.nvidia ? ' (Configured ✓)' : ''}</span>
                  <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active</span>
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={settings.apiKeySet.nvidia ? '••••••••••••••••' : 'nvapi-...'}
                  value={nvidiaKey}
                  onChange={(e) => setNvidiaKey(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Security and Auto-Approval */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoApproveSafe}
                onChange={(e) => setAutoApproveSafe(e.target.checked)}
              />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Auto-approve safe compilation and test commands</span>
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginLeft: '22px' }}>
              Destructive commands (rm, del, format) are always blocked or require explicit confirmation.
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
