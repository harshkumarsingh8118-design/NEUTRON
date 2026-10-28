import React, { useState, useEffect } from 'react';
import { X, Save, Copy, Check, FileText } from 'lucide-react';
import { api } from '../services/api';

interface FileViewerModalProps {
  filePath: string | null;
  onClose: () => void;
  onFileSaved?: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  filePath,
  onClose,
  onFileSaved,
}) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    api
      .fetchFileContent(filePath)
      .then((data) => setContent(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filePath]);

  if (!filePath) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveFileContent(filePath, content);
      if (onFileSaved) onFileSaved();
      alert(`File "${filePath}" saved successfully.`);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ width: '90%', maxWidth: '840px', height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>
              {filePath}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="copy-btn" onClick={handleCopy} title="Copy file content">
              {copied ? <Check size={14} style={{ color: 'var(--status-success)' }} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button className="action-icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
              Loading file...
            </div>
          ) : error ? (
            <div style={{ color: 'var(--status-error)', padding: '20px' }}>{error}</div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{
                flex: 1,
                width: '100%',
                background: '#07080b',
                color: '#e2e8f0',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                padding: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
                whiteSpace: 'pre',
              }}
            />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading}>
            <Save size={14} style={{ display: 'inline', marginRight: '6px' }} />
            {saving ? 'Saving...' : 'Save File'}
          </button>
        </div>
      </div>
    </div>
  );
};
