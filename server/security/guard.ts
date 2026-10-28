import path from 'path';

export type CommandRisk = 'safe' | 'sensitive' | 'forbidden';

export interface CommandAssessment {
  risk: CommandRisk;
  reason?: string;
  requiresApproval: boolean;
}

const FORBIDDEN_PATTERNS = [
  /format\s+[a-z]:/i,
  /rmdir\s+\/s\s+\/q\s+[a-z]:\\/i,
  /del\s+\/f\s+\/s\s+\/q\s+[a-z]:\\/i,
  /:(){ :\|:& };:/, // Fork bomb
  /chmod\s+-R\s+777\s+\//,
  /rm\s+-rf\s+\/(boot|etc|sys|dev|usr|var|bin|sbin)?(\s|$)/,
  /shutdown(\.exe)?\s+/i,
  /reg\s+(delete|add)\s+hklm/i,
  /diskpart/i,
];

const SENSITIVE_PATTERNS = [
  /\brm\s+/i,
  /\bdel\s+/i,
  /\brmdir\s+/i,
  /\bnpm\s+install\b/i,
  /\bpip\s+install\b/i,
  /\bgit\s+(reset|clean|push)\b/i,
  /\bcurl\b.*\|\s*(bash|sh|cmd|powershell)/i,
  /\bkill\b/i,
  /\btaskkill\b/i,
];

export class SecurityGuard {
  /**
   * Assesses command risk level and whether it requires explicit user approval.
   */
  static assessCommand(command: string): CommandAssessment {
    const trimmed = command.trim();

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          risk: 'forbidden',
          reason: 'Command contains potentially destructive system-level operations.',
          requiresApproval: false,
        };
      }
    }

    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          risk: 'sensitive',
          reason: 'Command performs file deletion, package installation, or state alteration.',
          requiresApproval: true,
        };
      }
    }

    return {
      risk: 'safe',
      requiresApproval: false,
    };
  }

  /**
   * Resolves a target relative path within the authorized workspace.
   * Throws an error if path escapes the authorized workspace.
   */
  static resolveSafePath(workspaceDir: string, relativeOrAbsolutePath: string): string {
    const cleanWorkspace = path.resolve(workspaceDir);
    let resolved: string;

    if (path.isAbsolute(relativeOrAbsolutePath)) {
      resolved = path.resolve(relativeOrAbsolutePath);
    } else {
      resolved = path.resolve(cleanWorkspace, relativeOrAbsolutePath);
    }

    // Windows paths: make case-insensitive check
    const normalizedTarget = resolved.toLowerCase().replace(/\\/g, '/');
    const normalizedWorkspace = cleanWorkspace.toLowerCase().replace(/\\/g, '/');

    if (!normalizedTarget.startsWith(normalizedWorkspace)) {
      throw new Error(`Security Exception: Access denied to path outside workspace root: "${relativeOrAbsolutePath}"`);
    }

    return resolved;
  }
}
