import fs from 'fs';
import path from 'path';
import { SecurityGuard } from '../security/guard';

export interface FileTreeNode {
  name: string;
  path: string; // Relative to workspace
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

export interface FileDiffResult {
  filePath: string;
  originalContent: string;
  newContent: string;
  diffText: string;
  additions: number;
  deletions: number;
}

export interface ProjectInspectionResult {
  primaryLanguage: string;
  frameworks: string[];
  filesCount: number;
  hasPackageJson: boolean;
  hasRequirementsTxt: boolean;
  hasPomOrGradle: boolean;
  summary: string;
}

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.vscode',
  '.idea',
  'dist',
  'build',
  'target',
  '__pycache__',
  '.DS_Store',
  'bin',
  'obj',
];

export class WorkspaceManager {
  private workspaceDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = path.resolve(workspaceDir);
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }
  }

  getWorkspaceDir(): string {
    return this.workspaceDir;
  }

  setWorkspaceDir(newDir: string): void {
    const resolved = path.resolve(newDir);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    this.workspaceDir = resolved;
  }

  /**
   * Retrieves the full file tree of the workspace
   */
  async getFileTree(dir: string = this.workspaceDir, maxDepth = 6, currentDepth = 0): Promise<FileTreeNode[]> {
    if (currentDepth > maxDepth) return [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      if (IGNORE_PATTERNS.includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.workspaceDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = await this.getFileTree(fullPath, maxDepth, currentDepth + 1);
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children,
        });
      } else {
        const stats = await fs.promises.stat(fullPath);
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
          size: stats.size,
        });
      }
    }

    // Sort: directories first, then alphabetically
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Reads a file content securely
   */
  async readFile(relativePath: string): Promise<string> {
    const safePath = SecurityGuard.resolveSafePath(this.workspaceDir, relativePath);
    if (!fs.existsSync(safePath)) {
      throw new Error(`File does not exist: ${relativePath}`);
    }
    const stats = await fs.promises.stat(safePath);
    if (stats.size > 2 * 1024 * 1024) {
      throw new Error(`File size (${(stats.size / 1024 / 1024).toFixed(2)} MB) exceeds 2MB limit.`);
    }
    return fs.promises.readFile(safePath, 'utf8');
  }

  /**
   * Writes/creates a file securely
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const safePath = SecurityGuard.resolveSafePath(this.workspaceDir, relativePath);
    const parentDir = path.dirname(safePath);
    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }
    await fs.promises.writeFile(safePath, content, 'utf8');
  }

  /**
   * Edits a file and returns the generated diff
   */
  async editFile(relativePath: string, newContent: string): Promise<FileDiffResult> {
    const safePath = SecurityGuard.resolveSafePath(this.workspaceDir, relativePath);
    let originalContent = '';
    if (fs.existsSync(safePath)) {
      originalContent = await fs.promises.readFile(safePath, 'utf8');
    }

    const diff = this.generateUnifiedDiff(relativePath, originalContent, newContent);
    await this.writeFile(relativePath, newContent);

    return diff;
  }

  /**
   * Generates a unified diff comparing original to new content
   */
  generateUnifiedDiff(filePath: string, original: string, modified: string): FileDiffResult {
    const origLines = original ? original.split(/\r?\n/) : [];
    const modLines = modified ? modified.split(/\r?\n/) : [];

    let diffText = `--- a/${filePath}\n+++ b/${filePath}\n`;
    let additions = 0;
    let deletions = 0;

    // Simple line-by-line diff generator
    const maxLen = Math.max(origLines.length, modLines.length);
    let inHunk = false;

    for (let i = 0; i < maxLen; i++) {
      const o = origLines[i];
      const m = modLines[i];

      if (o === undefined) {
        // Line added
        if (!inHunk) {
          diffText += `@@ -${Math.min(i + 1, origLines.length)},1 +${i + 1},1 @@\n`;
          inHunk = true;
        }
        diffText += `+ ${m}\n`;
        additions++;
      } else if (m === undefined) {
        // Line deleted
        if (!inHunk) {
          diffText += `@@ -${i + 1},1 +${Math.min(i + 1, modLines.length)},1 @@\n`;
          inHunk = true;
        }
        diffText += `- ${o}\n`;
        deletions++;
      } else if (o !== m) {
        if (!inHunk) {
          diffText += `@@ -${i + 1},1 +${i + 1},1 @@\n`;
          inHunk = true;
        }
        diffText += `- ${o}\n`;
        diffText += `+ ${m}\n`;
        deletions++;
        additions++;
      } else {
        // Matching line
        inHunk = false;
        diffText += `  ${o}\n`;
      }
    }

    return {
      filePath,
      originalContent: original,
      newContent: modified,
      diffText,
      additions,
      deletions,
    };
  }

  /**
   * Searches for a text pattern or regex across workspace files
   */
  async searchFiles(query: string, isRegex = false): Promise<Array<{ file: string; line: number; content: string }>> {
    const results: Array<{ file: string; line: number; content: string }> = [];
    const tree = await this.getFileTree();

    const flattenFiles = (nodes: FileTreeNode[]): string[] => {
      let paths: string[] = [];
      for (const node of nodes) {
        if (node.type === 'file') paths.push(node.path);
        if (node.children) paths = paths.concat(flattenFiles(node.children));
      }
      return paths;
    };

    const filePaths = flattenFiles(tree);
    const regex = isRegex ? new RegExp(query, 'gi') : null;

    for (const relPath of filePaths) {
      try {
        const content = await this.readFile(relPath);
        const lines = content.split(/\r?\n/);
        for (let idx = 0; idx < lines.length; idx++) {
          const line = lines[idx];
          const matches = regex ? regex.test(line) : line.toLowerCase().includes(query.toLowerCase());
          if (matches) {
            results.push({
              file: relPath,
              line: idx + 1,
              content: line.trim(),
            });
            if (results.length >= 100) break; // Limit search results
          }
        }
      } catch {
        // Skip unreadable/binary files
      }
      if (results.length >= 100) break;
    }

    return results;
  }

  /**
   * Inspects the project to determine primary language, dependencies, and structure
   */
  async inspectProject(): Promise<ProjectInspectionResult> {
    const tree = await this.getFileTree();
    const allPaths: string[] = [];
    const flatten = (nodes: FileTreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'file') allPaths.push(n.path);
        if (n.children) flatten(n.children);
      }
    };
    flatten(tree);

    let hasPackageJson = false;
    let hasRequirementsTxt = false;
    let hasPomOrGradle = false;
    const frameworks: string[] = [];
    const extCounts: Record<string, number> = {};

    for (const p of allPaths) {
      const ext = path.extname(p).toLowerCase();
      if (ext) {
        extCounts[ext] = (extCounts[ext] || 0) + 1;
      }
      const base = path.basename(p).toLowerCase();
      if (base === 'package.json') hasPackageJson = true;
      if (base === 'requirements.txt' || base === 'pyproject.toml') hasRequirementsTxt = true;
      if (base === 'pom.xml' || base === 'build.gradle' || base === 'build.gradle.kts') hasPomOrGradle = true;
    }

    // Determine language
    let primaryLanguage = 'Unknown';
    if (extCounts['.ts'] || extCounts['.tsx']) primaryLanguage = 'TypeScript';
    else if (extCounts['.js'] || extCounts['.jsx']) primaryLanguage = 'JavaScript';
    else if (extCounts['.py']) primaryLanguage = 'Python';
    else if (extCounts['.java']) primaryLanguage = 'Java';
    else if (extCounts['.c'] || extCounts['.h']) primaryLanguage = 'C';
    else if (extCounts['.cpp'] || extCounts['.hpp']) primaryLanguage = 'C++';
    else if (extCounts['.html']) primaryLanguage = 'HTML/CSS';

    if (hasPackageJson) {
      try {
        const pkgStr = await this.readFile('package.json');
        const pkg = JSON.parse(pkgStr);
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps['react']) frameworks.push('React');
        if (deps['next']) frameworks.push('Next.js');
        if (deps['vue']) frameworks.push('Vue');
        if (deps['express']) frameworks.push('Express');
        if (deps['vite']) frameworks.push('Vite');
      } catch {
        // ignore parse errors
      }
    }

    const summary = `Detected ${primaryLanguage} project with ${allPaths.length} files. Frameworks: ${frameworks.join(', ') || 'None detected'}.`;

    return {
      primaryLanguage,
      frameworks,
      filesCount: allPaths.length,
      hasPackageJson,
      hasRequirementsTxt,
      hasPomOrGradle,
      summary,
    };
  }
}
