import React, { useState } from 'react';
import {
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
} from 'lucide-react';
import type { ChatMessage } from '../types';
import { NeutronLogo } from './NeutronLogo';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isStreaming }) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="message-wrapper user">
        {message.files && message.files.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
            {message.files.map((f, i) => (
              <span
                key={i}
                style={{
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FileText size={12} />
                {f.name}
              </span>
            ))}
          </div>
        )}
        <div className="user-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="message-wrapper assistant">
      <div className="assistant-bubble">
        {/* Assistant Header */}
        <div className="assistant-header">
          <NeutronLogo size={18} />
          <span>NEUTRON</span>
        </div>

        {/* Task Plan Checklist if present */}
        {message.plan && message.plan.steps.length > 0 && (
          <div className="plan-container">
            <div className="plan-title">
              <CheckCircle2 size={14} style={{ color: 'var(--accent-blue)' }} />
              <span>Execution Plan: {message.plan.goal}</span>
            </div>
            <div className="plan-steps-list">
              {message.plan.steps.map((step) => (
                <div key={step.id} className="plan-step-item">
                  <div style={{ marginTop: '2px' }}>
                    {step.status === 'completed' && (
                      <CheckCircle2 size={14} style={{ color: 'var(--status-success)' }} />
                    )}
                    {step.status === 'in_progress' && (
                      <Loader2
                        size={14}
                        style={{ color: 'var(--accent-blue)', animation: 'spin 1s linear infinite' }}
                      />
                    )}
                    {step.status === 'failed' && (
                      <AlertCircle size={14} style={{ color: 'var(--status-error)' }} />
                    )}
                    {step.status === 'pending' && (
                      <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <div>
                    <div className="plan-step-title">{step.title}</div>
                    {step.detail && <div className="plan-step-detail">{step.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tool Execution Cards if any */}
        {message.toolsCalled && message.toolsCalled.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {message.toolsCalled.map((tool, idx) => (
              <ToolCard key={idx} tool={tool} />
            ))}
          </div>
        )}

        {/* Markdown Formatted Content */}
        <div className="markdown-content">
          <MarkdownRenderer content={message.content} />
          {isStreaming && (
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '14px',
                background: 'var(--accent-blue)',
                marginLeft: '4px',
                animation: 'blink 1s infinite',
                verticalAlign: 'middle',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Interactive Tool Execution Card
 */
const ToolCard: React.FC<{ tool: any }> = ({ tool }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tool-card">
      <div className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="tool-badge">
          {tool.toolName.includes('command') ? <Terminal size={13} /> : <FileCode size={13} />}
          <span>{tool.toolName}</span>
          {tool.params?.path && (
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
              ({tool.params.path})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`tool-status-pill ${tool.status}`}>
            {tool.status}
          </span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {tool.params && (
            <div style={{ marginBottom: '6px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Parameters:</div>
              <pre style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(tool.params, null, 2)}
              </pre>
            </div>
          )}
          {tool.diff && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Diff Generated:</div>
              <div className="diff-container" style={{ maxHeight: '160px' }}>
                {tool.diff.diffText.split('\n').map((line: string, i: number) => {
                  let type = '';
                  if (line.startsWith('+')) type = 'addition';
                  else if (line.startsWith('-')) type = 'deletion';
                  else if (line.startsWith('@@')) type = 'header';
                  return (
                    <div key={i} className={`diff-line ${type}`}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Markdown Renderer with Code Syntax Highlighting and Unified Diff Parser
 */
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  // Split content by code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore) {
      parts.push(<TextSection key={`text-${lastIndex}`} text={textBefore} />);
    }

    const lang = match[1] || 'code';
    const code = match[2];

    if (lang === 'diff') {
      parts.push(<DiffBlock key={`diff-${match.index}`} diff={code} />);
    } else {
      parts.push(<CodeBlock key={`code-${match.index}`} language={lang} code={code} />);
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = content.substring(lastIndex);
  if (remaining) {
    parts.push(<TextSection key={`text-remaining`} text={remaining} />);
  }

  return <div>{parts}</div>;
};

/**
 * Code Block Component with 1-click Copy
 */
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>{language}</span>
        <button className="copy-btn" onClick={handleCopy} title="Copy code">
          {copied ? <Check size={12} style={{ color: 'var(--status-success)' }} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="code-block-content">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Diff Block Component
 */
const DiffBlock: React.FC<{ diff: string }> = ({ diff }) => {
  const lines = diff.split('\n');

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>Unified Diff</span>
      </div>
      <div className="diff-container" style={{ padding: '8px' }}>
        {lines.map((line, idx) => {
          let lineType = '';
          if (line.startsWith('+')) lineType = 'addition';
          else if (line.startsWith('-')) lineType = 'deletion';
          else if (line.startsWith('@@')) lineType = 'header';
          return (
            <div key={idx} className={`diff-line ${lineType}`}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Text Section with markdown bold, headers, lists, quotes, inline code
 */
const TextSection: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <div>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (trimmed.startsWith('### ')) {
          return <h3 key={i}>{formatInline(trimmed.slice(4))}</h3>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={i}>{formatInline(trimmed.slice(3))}</h2>;
        }
        if (trimmed.startsWith('# ')) {
          return <h1 key={i}>{formatInline(trimmed.slice(2))}</h1>;
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={i}>
              {formatInline(trimmed.slice(2))}
            </blockquote>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <ul key={i} style={{ margin: '4px 0 4px 20px' }}>
              <li>{formatInline(trimmed.slice(2))}</li>
            </ul>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const content = trimmed.replace(/^\d+\.\s/, '');
          return (
            <ol key={i} style={{ margin: '4px 0 4px 20px' }}>
              <li>{formatInline(content)}</li>
            </ol>
          );
        }
        if (!trimmed) {
          return <div key={i} style={{ height: '8px' }} />;
        }

        return <p key={i}>{formatInline(line)}</p>;
      })}
    </div>
  );
};

function formatInline(str: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const regex = /(\*\*.*?\*\*|`[^`]+`)/g;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > last) {
      parts.push(str.substring(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            background: 'var(--bg-surface-active)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-accent)',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    last = match.index + token.length;
  }

  if (last < str.length) {
    parts.push(str.substring(last));
  }

  return parts.length > 0 ? parts : str;
}
