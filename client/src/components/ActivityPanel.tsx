import React, { useState } from 'react';
import {
  X,
  ListTodo,
  GitCompare,
  Terminal as TerminalIcon,
  FolderTree,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import type { TaskStep, FileDiff, CommandResult, FileNode } from '../types';

interface ActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoal?: string;
  steps: TaskStep[];
  diffs: FileDiff[];
  commands: CommandResult[];
  workspaceTree: FileNode[];
  onSelectFile: (filePath: string) => void;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  isOpen,
  onClose,
  currentGoal,
  steps,
  diffs,
  commands,
  workspaceTree,
  onSelectFile,
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'diffs' | 'terminal' | 'tree'>('plan');

  if (!isOpen) return null;

  return (
    <aside className="neutron-activity-panel">
      {/* Activity Header */}
      <div className="activity-header">
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          AGENT ACTIVITY
        </span>
        <button className="action-icon-btn" onClick={onClose} title="Close activity panel">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="activity-tabs">
        <button
          className={`activity-tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >
          <ListTodo size={12} style={{ display: 'inline', marginRight: 4 }} />
          Plan ({steps.length})
        </button>

        <button
          className={`activity-tab-btn ${activeTab === 'diffs' ? 'active' : ''}`}
          onClick={() => setActiveTab('diffs')}
        >
          <GitCompare size={12} style={{ display: 'inline', marginRight: 4 }} />
          Diffs ({diffs.length})
        </button>

        <button
          className={`activity-tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          <TerminalIcon size={12} style={{ display: 'inline', marginRight: 4 }} />
          Terminal ({commands.length})
        </button>

        <button
          className={`activity-tab-btn ${activeTab === 'tree' ? 'active' : ''}`}
          onClick={() => setActiveTab('tree')}
        >
          <FolderTree size={12} style={{ display: 'inline', marginRight: 4 }} />
          Explorer
        </button>
      </div>

      {/* Content Area */}
      <div className="activity-content">
        {/* Tab: Task Plan */}
        {activeTab === 'plan' && (
          <div>
            {currentGoal && (
              <div
                style={{
                  background: 'var(--bg-surface-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  CURRENT GOAL
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {currentGoal}
                </div>
              </div>
            )}

            {steps.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 10px', fontSize: '13px' }}>
                No active plan. Start a coding task to see NEUTRON's autonomous steps.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {steps.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      gap: '10px',
                    }}
                  >
                    <div style={{ marginTop: '2px' }}>
                      {s.status === 'completed' && (
                        <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
                      )}
                      {s.status === 'in_progress' && (
                        <Loader2
                          size={16}
                          style={{
                            color: 'var(--accent-blue)',
                            animation: 'spin 1s linear infinite',
                          }}
                        />
                      )}
                      {s.status === 'failed' && (
                        <AlertCircle size={16} style={{ color: 'var(--status-error)' }} />
                      )}
                      {s.status === 'pending' && (
                        <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {s.title}
                      </div>
                      {s.detail && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {s.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Diffs */}
        {activeTab === 'diffs' && (
          <div>
            {diffs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 10px', fontSize: '13px' }}>
                No file modifications yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {diffs.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--bg-surface-card)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <span style={{ color: 'var(--text-accent)' }}>{d.filePath}</span>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                        <span style={{ color: 'var(--diff-add-text)' }}>+{d.additions}</span>
                        <span style={{ color: 'var(--diff-del-text)' }}>-{d.deletions}</span>
                      </div>
                    </div>
                    <div className="diff-container" style={{ maxHeight: '200px' }}>
                      {d.diffText.split('\n').map((line, idx) => {
                        let type = '';
                        if (line.startsWith('+')) type = 'addition';
                        else if (line.startsWith('-')) type = 'deletion';
                        else if (line.startsWith('@@')) type = 'header';
                        return (
                          <div key={idx} className={`diff-line ${type}`}>
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Terminal Execution */}
        {activeTab === 'terminal' && (
          <div>
            {commands.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 10px', fontSize: '13px' }}>
                No commands executed yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {commands.map((cmd, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#07080a',
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 10px',
                        background: 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>$ {cmd.command}</span>
                      <span
                        style={{
                          color: cmd.exitCode === 0 ? 'var(--status-success)' : 'var(--status-error)',
                        }}
                      >
                        code: {cmd.exitCode} ({cmd.durationMs}ms)
                      </span>
                    </div>
                    <div
                      style={{
                        padding: '10px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'pre-wrap',
                        color: cmd.exitCode === 0 ? '#38bdf8' : '#f87171',
                        maxHeight: '180px',
                        overflowY: 'auto',
                      }}
                    >
                      {cmd.stdout || cmd.stderr || 'No output produced.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: File Tree Explorer */}
        {activeTab === 'tree' && (
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
              PROJECT FILES (Click to view)
            </div>
            <FileTreeRenderer nodes={workspaceTree} onSelectFile={onSelectFile} />
          </div>
        )}
      </div>
    </aside>
  );
};

const FileTreeRenderer: React.FC<{ nodes: FileNode[]; onSelectFile: (path: string) => void }> = ({
  nodes,
  onSelectFile,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {nodes.map((node) => (
        <FileTreeNodeItem key={node.path} node={node} onSelectFile={onSelectFile} level={0} />
      ))}
    </div>
  );
};

const FileTreeNodeItem: React.FC<{
  node: FileNode;
  onSelectFile: (path: string) => void;
  level: number;
}> = ({ node, onSelectFile, level }) => {
  const [open, setOpen] = useState(true);
  const isDir = node.type === 'directory';

  return (
    <div>
      <div
        onClick={() => {
          if (isDir) {
            setOpen(!open);
          } else {
            onSelectFile(node.path);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 6px',
          paddingLeft: `${level * 14 + 6}px`,
          borderRadius: '4px',
          cursor: 'pointer',
          color: isDir ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {isDir ? (
          <FolderTree size={13} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
        ) : (
          <FileText size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
      </div>

      {isDir && open && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNodeItem
              key={child.path}
              node={child}
              onSelectFile={onSelectFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
