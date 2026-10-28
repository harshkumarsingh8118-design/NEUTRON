import React, { useRef, useState, useEffect } from 'react';
import {
  Plus,
  Star,
  ChevronDown,
  X,
  Square,
  ArrowRight,
} from 'lucide-react';
import type { ModelProvider } from '../types';

interface PromptComposerProps {
  onSend: (prompt: string, files?: File[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  providers: ModelProvider[];
  activeModel: string;
  onSelectModel: (providerId: string, modelId: string) => void;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({
  onSend,
  onStop,
  isStreaming,
  providers,
  activeModel,
  onSelectModel,
}) => {
  const [text, setText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed && attachedFiles.length === 0) return;
    if (isStreaming) return;

    onSend(trimmed, attachedFiles);
    setText('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', width: '100%', maxWidth: '840px' }}>
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ffffff',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <span>{file.name}</span>
              <button
                onClick={() => removeFile(idx)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* The glowing Minded composer card */}
      <div className="minded-composer-box">
        <textarea
          ref={textareaRef}
          className="minded-textarea"
          placeholder="Message Neutron. Ask a question or tell it what to work on…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        {/* Bottom controls */}
        <div className="minded-composer-bottom">
          {/* File attach plus button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            multiple
          />
          <button
            className="attach-plus-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file or context"
          >
            <Plus size={18} />
          </button>

          <div className="composer-actions-right">
            {/* Recommended dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                className="recommended-dropdown-pill"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <Star size={13} fill="#ff6644" style={{ color: '#ff6644' }} />
                <span>Recommended</span>
                <ChevronDown size={13} />
              </button>

              {showDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: '8px',
                    background: '#ffffff',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '6px',
                    width: '240px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    zIndex: 50,
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px', fontWeight: 700 }}>
                    Select Agent Model
                  </div>
                  {providers.flatMap((p) =>
                    p.models.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onSelectModel(p.id, m.id);
                          setShowDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 10px',
                          background: m.id === activeModel ? '#f4f5f8' : 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                    <span style={{ fontWeight: 600 }}>{m.name}{!p.isConfigured && p.id !== 'ollama' && p.id !== 'neutron-builtin' ? ' · add API key in Settings' : ''}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Glowing let's Go! action button */}
            {isStreaming ? (
              <button
                className="lets-go-btn"
                style={{ background: '#ef4444', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }}
                onClick={onStop}
                title="Stop Generation"
              >
                <Square size={13} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="lets-go-btn"
                onClick={handleSubmit}
                disabled={!text.trim() && attachedFiles.length === 0}
                title="Submit Request"
              >
                <span>let's Go!</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
