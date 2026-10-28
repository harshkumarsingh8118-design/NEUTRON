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
  providers,
  onSave,
}) => {
  const [workspaceDir, setWorkspaceDir] = useState(settings.workspaceDir);
  const [activeProvider, setActiveProvider] = useState(settings.activeProvider);
  const [activeModel, setActiveModel] = useState(settings.activeModel);
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [autoApproveSafe, setAutoApproveSafe] = useState(settings.autoApproveSafe);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        workspaceDir,
        activeProvider,
        activeModel,
        geminiKey: geminiKey.trim() || undefined,
        openaiKey: openaiKey.trim() || undefined,
        anthropicKey: anthropicKey.trim() || undefined,
        groqKey: groqKey.trim() || undefined,
        autoApproveSafe,
      });
      onClose();
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedProviderObj = providers.find((p) => p.id === activeProvider);

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

          {/* Model and Provider Setting */}
          <div className="form-group">
            <label>Default AI Provider</label>
            <select
              className="form-input"
              value={activeProvider}
              onChange={(e) => {
                setActiveProvider(e.target.value);
                const prov = providers.find((p) => p.id === e.target.value);
                if (prov && prov.models[0]) {
                  setActiveModel(prov.models[0].id);
                }
              }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isConfigured ? '✓' : '(No Key)'}
                </option>
              ))}
            </select>
          </div>

          {selectedProviderObj && (
            <div className="form-group">
              <label>Default Model</label>
              <select
                className="form-input"
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
              >
                {selectedProviderObj.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* API Keys Configuration */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={14} />
              <span>Provider API Keys (Stored locally on server)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label>
                  Google Gemini API Key {settings.apiKeySet.gemini ? ' (Configured ✓)' : ''}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={settings.apiKeySet.gemini ? '••••••••••••••••' : 'AIzaSy...'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  OpenAI API Key {settings.apiKeySet.openai ? ' (Configured ✓)' : ''}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={settings.apiKeySet.openai ? '••••••••••••••••' : 'sk-...'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  Anthropic API Key {settings.apiKeySet.anthropic ? ' (Configured ✓)' : ''}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={settings.apiKeySet.anthropic ? '••••••••••••••••' : 'sk-ant-...'}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  Groq API Key {settings.apiKeySet.groq ? ' (Configured ✓)' : ''}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={settings.apiKeySet.groq ? '••••••••••••••••' : 'gsk_...'}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
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
