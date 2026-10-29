import React, { useState } from 'react';
import { X, Sliders } from 'lucide-react';
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
  const [autoApproveSafe, setAutoApproveSafe] = useState(settings.autoApproveSafe);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
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
          <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--surface-secondary)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Your account has a private workspace. NVIDIA credentials are configured only through the server environment and are never exposed in the browser.
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
