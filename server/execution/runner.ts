import { spawn } from 'child_process';
import path from 'path';
import { SecurityGuard, CommandAssessment } from '../security/guard';
import { config } from '../config';

export interface CommandExecutionResult {
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  truncated: boolean;
  assessment: CommandAssessment;
}

export class ExecutionRunner {
  private workspaceDir: string;
  private timeoutMs: number;
  private maxOutputBytes: number;

  constructor(workspaceDir: string, timeoutMs = config.commandTimeoutMs, maxOutputBytes = config.maxOutputBytes) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.timeoutMs = timeoutMs;
    this.maxOutputBytes = maxOutputBytes;
  }

  setWorkspaceDir(workspaceDir: string) {
    this.workspaceDir = path.resolve(workspaceDir);
  }

  /**
   * Executes a command within the authorized workspace directory with timeout and size guards
   */
  async runCommand(
    command: string,
    customCwd?: string,
    onOutputChunk?: (type: 'stdout' | 'stderr', chunk: string) => void
  ): Promise<CommandExecutionResult> {
    const assessment = SecurityGuard.assessCommand(command);

    if (assessment.risk === 'forbidden') {
      return {
        command,
        cwd: this.workspaceDir,
        exitCode: 126,
        stdout: '',
        stderr: `Execution blocked by Security Policy: ${assessment.reason}`,
        durationMs: 0,
        timedOut: false,
        truncated: false,
        assessment,
      };
    }

    const execCwd = customCwd
      ? SecurityGuard.resolveSafePath(this.workspaceDir, customCwd)
      : this.workspaceDir;

    const startTime = Date.now();
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let truncated = false;
    let timedOut = false;

    return new Promise<CommandExecutionResult>((resolve) => {
      // Use cmd.exe on Windows for full && / || compatibility, /bin/sh on POSIX
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'cmd.exe' : '/bin/sh';
      const shellArgs = isWin ? ['/d', '/s', '/c', command] : ['-c', command];

      const child = spawn(shell, shellArgs, {
        cwd: execCwd,
        env: {
          ...process.env,
          CI: 'true',
          PYTHONUNBUFFERED: '1',
          NODE_ENV: 'development',
        },
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        // Force kill after 2s if still running
        setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {}
        }, 2000);
      }, this.timeoutMs);

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        if (stdoutBuffer.length + text.length > this.maxOutputBytes) {
          truncated = true;
          const remaining = this.maxOutputBytes - stdoutBuffer.length;
          if (remaining > 0) stdoutBuffer += text.slice(0, remaining);
        } else {
          stdoutBuffer += text;
        }
        if (onOutputChunk) onOutputChunk('stdout', text);
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        if (stderrBuffer.length + text.length > this.maxOutputBytes) {
          truncated = true;
          const remaining = this.maxOutputBytes - stderrBuffer.length;
          if (remaining > 0) stderrBuffer += text.slice(0, remaining);
        } else {
          stderrBuffer += text;
        }
        if (onOutputChunk) onOutputChunk('stderr', text);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        if (timedOut) {
          stderrBuffer += `\n[Execution timed out after ${this.timeoutMs}ms]`;
        }
        if (truncated) {
          stdoutBuffer += `\n[Output truncated at ${this.maxOutputBytes / 1024} KB limit]`;
        }

        resolve({
          command,
          cwd: execCwd,
          exitCode: timedOut ? 124 : code,
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          durationMs,
          timedOut,
          truncated,
          assessment,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({
          command,
          cwd: execCwd,
          exitCode: 1,
          stdout: stdoutBuffer,
          stderr: `Process spawn error: ${err.message}`,
          durationMs,
          timedOut: false,
          truncated,
          assessment,
        });
      });
    });
  }

  /**
   * Helper to execute Java files (compiles and runs)
   */
  async runJava(javaFilePath: string): Promise<CommandExecutionResult> {
    const safePath = SecurityGuard.resolveSafePath(this.workspaceDir, javaFilePath);
    const dir = path.dirname(safePath);
    const fileName = path.basename(safePath);
    const className = path.basename(safePath, '.java');
    const cmd = `javac ${fileName} && java ${className}`;
    return this.runCommand(cmd, dir);
  }

  /**
   * Helper to execute Python scripts
   */
  async runPython(pythonFilePath: string): Promise<CommandExecutionResult> {
    const safePath = SecurityGuard.resolveSafePath(this.workspaceDir, pythonFilePath);
    const dir = path.dirname(safePath);
    const fileName = path.basename(safePath);
    const cmd = `python ${fileName}`;
    return this.runCommand(cmd, dir);
  }

  /**
   * Helper to execute C/C++ files
   */
  async runC(cFilePath: string): Promise<CommandExecutionResult> {
    const safePath = SecurityGuard.resolveSafePath(this.workspaceDir, cFilePath);
    const dir = path.dirname(safePath);
    const fileName = path.basename(safePath);
    const outName = `${path.basename(safePath, path.extname(safePath))}.exe`;
    const compiler = safePath.endsWith('.cpp') ? 'g++' : 'gcc';
    const cmd = `${compiler} ${fileName} -o ${outName} && ${outName}`;
    return this.runCommand(cmd, dir);
  }

  /**
   * Helper to execute Node.js scripts
   */
  async runNode(scriptPath: string): Promise<CommandExecutionResult> {
    const safePath = SecurityGuard.resolveSafePath(this.workspaceDir, scriptPath);
    const dir = path.dirname(safePath);
    const fileName = path.basename(safePath);
    const cmd = `node ${fileName}`;
    return this.runCommand(cmd, dir);
  }
}
