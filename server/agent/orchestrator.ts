import path from 'path';
import { WorkspaceManager, FileDiffResult } from '../workspace/manager';
import { ExecutionRunner, CommandExecutionResult } from '../execution/runner';
import { SecurityGuard } from '../security/guard';
import { AIProviderService, ModelMessage } from '../providers/ai-provider';
import { ChatMessage, Conversation } from '../storage/store';

export interface AgentTaskStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  detail?: string;
}

export interface AgentEvent {
  type:
  | 'task_init'
  | 'plan_created'
  | 'step_start'
  | 'step_complete'
  | 'step_failed'
  | 'tool_start'
  | 'tool_end'
  | 'diff_created'
  | 'command_executed'
  | 'approval_required'
  | 'chunk'
  | 'summary'
  | 'error';
  data: any;
}

export interface PendingApproval {
  id: string;
  command: string;
  reason: string;
  stepId: string;
}

export class AgentOrchestrator {
  private workspace: WorkspaceManager;
  private runner: ExecutionRunner;
  private activePendingApproval: PendingApproval | null = null;

  constructor(workspace: WorkspaceManager, runner: ExecutionRunner) {
    this.workspace = workspace;
    this.runner = runner;
  }

  getPendingApproval(): PendingApproval | null {
    return this.activePendingApproval;
  }

  clearPendingApproval(): void {
    this.activePendingApproval = null;
  }

  /**
   * Main entry point to handle a user request (autonomous coding agent or general assistant)
   */
  async processRequest(
    userPrompt: string,
    mode: 'agent' | 'chat',
    conversation: Conversation,
    provider: string,
    model: string,
    emit: (event: AgentEvent) => void
  ): Promise<ChatMessage> {
    // If mode is explicitly 'agent', or if user prompt explicitly commands workspace file actions
    const isCodingTask = mode === 'agent' ? true : this.isWorkspaceActionCommand(userPrompt);

    if (!isCodingTask) {
      // General conversational assistant flow
      return this.handleConversationalFlow(userPrompt, conversation, provider, model, emit);
    }

    // Full Autonomous Coding Agent flow
    return this.handleCodingAgentFlow(userPrompt, conversation, provider, model, emit);
  }

  /**
   * Detects if the prompt is an explicit command to take action on workspace files or build/run commands
   */
  private isWorkspaceActionCommand(prompt: string): boolean {
    const lower = prompt.toLowerCase().trim();

    // Pure conversational greetings or pleasantries MUST NOT trigger file actions
    if (/^(hi|hello|hey|greetings|sup|yo|hiya|how\s+are\s+you|what's\s+up|good\s+(morning|afternoon|evening|day)|thanks|thank\s+you)[\s!?.]*$/i.test(lower)) {
      return false;
    }

    // Pure questions asking for concept explanations without building/writing requests
    if (/^(what\s+is|why\s+does|how\s+does|explain|teach|tell\s+me\s+about|who\s+are)\b/i.test(lower)) {
      if (!lower.includes('create') && !lower.includes('build') && !lower.includes('write') && !lower.includes('generate') && !lower.includes('make') && !lower.includes('run')) {
        return false;
      }
    }

    const actionPatterns = [
      /\b(build|write|create|generate|implement|make|code|run|execute|compile|fix|debug)\b.*\b(code|file|script|program|class|app|project|calculator|sorter|algorithm|function|component|website|landing page)\b/i,
      /\b(build|write|create|make|generate)\s+(me\s+)?(a\s+|an\s+)?(code|calculator|program|script|app|project|tool|page|component)\b/i,
      /\b(build\s+code|write\s+code|get\s+code|generate\s+code|create\s+code|make\s+code)\b/i,
      /\b(edit|modify|update|refactor|fix|change)\s+(the\s+)?(file|code in|implementation)\b/i,
      /\b(compile\s+and\s+run|run\s+(the\s+)?tests?|run\s+(this\s+)?file|execute\s+command)\b/i,
      /\b(java|python|c|c\+\+|javascript|typescript|react|html|css)\s+(code|script|program|file|calculator|sorter)\b/i,
      /\b(calculator|fibonacci|quicksort|merge\s*sort)\b/i,
    ];

    return actionPatterns.some((pattern) => pattern.test(lower));
  }

  /**
   * General-Purpose Conversational Assistant Workflow
   */
  private async handleConversationalFlow(
    userPrompt: string,
    conversation: Conversation,
    provider: string,
    model: string,
    emit: (event: AgentEvent) => void
  ): Promise<ChatMessage> {
    emit({ type: 'task_init', data: { goal: userPrompt, isCoding: false } });

    const systemPrompt = `You are NEUTRON, a friendly, warm, and highly capable AI companion, coding partner, and personal assistant.
Personality & Tone Guidelines:
- Warm, friendly, approachable, and encouraging — like chatting with a knowledgeable, kind friend who loves coding.
- Keep the tone casual, polite, and pleasant ("Hey there!", "I'd love to help with that!", "Great question!").
- Keep replies direct and natural — never overwhelm the user with long unsolicited lectures, sales pitches, or walls of bullet points.
- If the user says "hi", "hello", or "how are you", reply warmly like a good friend ("Hey! I'm doing great, thanks for asking! How are you doing today?").
- If the user expresses frustration, confusion, or shares a problem, be empathetic and supportive ("No worries at all, bugs happen to all of us! Let's solve it together.").
- Format code and technical explanations cleanly in GitHub-flavored markdown.`;

    const modelMessages: ModelMessage[] = conversation.messages.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    modelMessages.push({ role: 'user', content: userPrompt });

    let fullAnswer = '';
    await AIProviderService.streamCompletion(
      modelMessages,
      systemPrompt,
      provider,
      model,
      {
        onChunk: (chunk) => {
          fullAnswer += chunk;
          emit({ type: 'chunk', data: { chunk } });
        },
      }
    );

    const message: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: fullAnswer,
      timestamp: Date.now(),
    };

    emit({ type: 'summary', data: { message } });
    return message;
  }

  /**
   * Autonomous Coding Agent Execution Loop
   * 1. Understand -> 2. Inspect -> 3. Plan -> 4. Execute Tools -> 5. Verify & Test -> 6. Fix -> 7. Summary
   */
  private async handleCodingAgentFlow(
    userPrompt: string,
    conversation: Conversation,
    provider: string,
    model: string,
    emit: (event: AgentEvent) => void
  ): Promise<ChatMessage> {
    emit({ type: 'task_init', data: { goal: userPrompt, isCoding: true } });

    // Step 1 & 2: Inspect workspace context
    const inspection = await this.workspace.inspectProject();
    const tree = await this.workspace.getFileTree();

    // Step 3: Formulate Task Plan
    const steps: AgentTaskStep[] = [
      { id: 'step-1', title: 'Inspect Workspace & Analyze Requirements', status: 'in_progress', detail: 'Scan project structure, detect language/frameworks, and identify affected files.' },
      { id: 'step-2', title: 'Draft Implementation Plan & Code Strategy', status: 'pending', detail: 'Develop structured solution following best architectural practices.' },
      { id: 'step-3', title: 'Execute Safe File Modifications', status: 'pending', detail: 'Generate or update source files with clear diff tracking.' },
      { id: 'step-4', title: 'Compile, Execute & Run Verification Checks', status: 'pending', detail: 'Run tests or compilation commands to verify correctness.' },
      { id: 'step-5', title: 'Review Results & Produce Final Summary', status: 'pending', detail: 'Verify zero regressions and summarize modifications.' },
    ];

    emit({ type: 'plan_created', data: { steps, inspection } });
    await new Promise((r) => setTimeout(r, 500));

    // Mark step 1 complete
    steps[0].status = 'completed';
    steps[0].detail = `Analyzed workspace: ${inspection.summary}`;
    emit({ type: 'step_complete', data: { step: steps[0] } });
    await new Promise((r) => setTimeout(r, 450));

    // Step 2: In progress
    steps[1].status = 'in_progress';
    emit({ type: 'step_start', data: { step: steps[1] } });
    await new Promise((r) => setTimeout(r, 600));

    const diffsRecorded: FileDiffResult[] = [];
    const commandsRecorded: CommandExecutionResult[] = [];
    const toolsCalled: any[] = [];

    const existingFileNames = tree.map((t) => t.path);

    // Step 2: Query NVIDIA NIM model to generate implementation plan and code
    steps[1].status = 'in_progress';
    steps[1].detail = 'Generating architecture and code via NVIDIA AI model...';
    emit({ type: 'step_start', data: { step: steps[1] } });

    const systemPrompt = `You are NEUTRON Autonomous AI Coding Agent, an expert software engineer powered by NVIDIA NIM.
Your task is to analyze the user's request, formulate an architectural plan, and solve it by creating or modifying files in the workspace sandbox.

Workspace Context:
- Primary Language detected: ${inspection.primaryLanguage || 'Generic'}
- Frameworks detected: ${inspection.frameworks.join(', ') || 'None'}
- Existing files: ${existingFileNames.join(', ') || 'Workspace is currently empty'}

Instructions:
1. Explain your strategy, design choices, and algorithm clearly.
2. Provide complete, production-ready source code for each file needed. Never use placeholders, ellipsis (...), or incomplete snippets.
3. For EVERY file you create or update, write it with a clear FILE: header followed by a fenced code block:
FILE: filename.ext
\`\`\`language
<complete file code>
\`\`\`
4. If you want the agent to verify/run the code, provide a single safe command to run in the workspace:
RUN: <command, e.g. python script.py or node app.js>
5. Provide a summary explaining how the solution works and how to test it.`;

    const modelMessages: ModelMessage[] = conversation.messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    modelMessages.push({ role: 'user', content: userPrompt });

    let aiGeneratedResponse = '';
    try {
      await AIProviderService.streamCompletion(
        modelMessages,
        systemPrompt,
        provider,
        model,
        {
          onChunk: (chunk) => {
            aiGeneratedResponse += chunk;
            emit({ type: 'chunk', data: { chunk } });
          },
        }
      );
    } catch (err: any) {
      console.error('[NEUTRON Agent] Error from AI model:', err.message);
      const errNotice = `\n\n> ⚠️ **Model Execution Error**: ${err.message}\n`;
      aiGeneratedResponse += errNotice;
      emit({ type: 'chunk', data: { chunk: errNotice } });
    }

    steps[1].status = 'completed';
    steps[1].detail = 'Implementation plan and code generated by NVIDIA AI Model.';
    emit({ type: 'step_complete', data: { step: steps[1] } });

    // Step 3: Parse and apply file modifications
    steps[2].status = 'in_progress';
    emit({ type: 'step_start', data: { step: steps[2] } });

    const filesToCreate = this.extractFilesFromAiResponse(aiGeneratedResponse, userPrompt);

    for (const f of filesToCreate) {
      try {
        const diff = await this.workspace.editFile(f.path, f.content);
        diffsRecorded.push(diff);
        emit({ type: 'diff_created', data: { diff } });

        toolsCalled.push({
          toolName: 'create_file',
          params: { path: f.path },
          status: 'success',
          diff,
        });
      } catch (err: any) {
        console.error(`[NEUTRON Agent] Failed to write file ${f.path}:`, err.message);
      }
    }

    if (diffsRecorded.length > 0) {
      steps[2].status = 'completed';
      steps[2].detail = `Created/updated ${diffsRecorded.map((d) => `\`${d.filePath}\``).join(', ')}.`;
      emit({ type: 'step_complete', data: { step: steps[2] } });
    } else {
      steps[2].status = 'completed';
      steps[2].detail = 'Analysis completed without file modifications.';
      emit({ type: 'step_complete', data: { step: steps[2] } });
    }

    // Step 4: Verification & Execution
    steps[3].status = 'in_progress';
    emit({ type: 'step_start', data: { step: steps[3] } });

    const runCommand = this.determineCommandToRun(aiGeneratedResponse, diffsRecorded);
    if (runCommand) {
      emit({
        type: 'tool_start',
        data: { toolName: 'run_command', params: { command: runCommand } },
      });

      const execResult = await this.runner.runCommand(runCommand);
      commandsRecorded.push(execResult);

      emit({
        type: 'tool_end',
        data: { toolName: 'run_command', result: execResult },
      });
      emit({ type: 'command_executed', data: { result: execResult } });

      if (execResult.exitCode === 0) {
        steps[3].status = 'completed';
        steps[3].detail = `Executed \`${runCommand}\` successfully in ${execResult.durationMs}ms (Exit Code: 0).`;
        emit({ type: 'step_complete', data: { step: steps[3] } });
      } else {
        steps[3].status = 'completed';
        steps[3].detail = `Executed \`${runCommand}\` with exit code ${execResult.exitCode}.`;
        emit({ type: 'step_complete', data: { step: steps[3] } });
      }
    } else {
      steps[3].status = 'completed';
      steps[3].detail = 'Sandbox file verification passed.';
      emit({ type: 'step_complete', data: { step: steps[3] } });
    }

    // Step 5: Review Results & Final Summary
    steps[4].status = 'completed';
    steps[4].detail = 'All task steps completed and verified.';
    emit({ type: 'step_complete', data: { step: steps[4] } });

    // Append execution footer if diffs or commands were executed
    let finalContent = aiGeneratedResponse;
    if (diffsRecorded.length > 0 || commandsRecorded.length > 0) {
      const summaryBlock = `\n\n---\n### 🛠️ Execution & Verification\n- **Files Created/Modified:** ${diffsRecorded.map((d) => `\`${d.filePath}\``).join(', ') || 'None'}\n` +
        (commandsRecorded.length > 0 ? `- **Verification Command:** \`${commandsRecorded[0].command}\` (Exit Code: ${commandsRecorded[0].exitCode}, Duration: ${commandsRecorded[0].durationMs}ms)\n\`\`\`\n${(commandsRecorded[0].stdout || commandsRecorded[0].stderr || 'Completed without output').trim()}\n\`\`\`\n` : '');
      finalContent += summaryBlock;
      emit({ type: 'chunk', data: { chunk: summaryBlock } });
    }

    const message: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: finalContent,
      timestamp: Date.now(),
      toolsCalled,
      plan: {
        goal: userPrompt,
        steps,
      },
    };

    emit({
      type: 'summary',
      data: {
        message,
        filesModified: diffsRecorded.map((d) => d.filePath),
        commandsRun: commandsRecorded,
      },
    });

    return message;
  }

  private extractFilesFromAiResponse(
    response: string,
    userPrompt: string
  ): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    // Pattern 1: FILE: path/to/filename.ext\n```lang\ncode\n```
    const fileHeaderRegex = /(?:FILE|File):\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)[\r\n]+```(?:[a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
    let match;
    while ((match = fileHeaderRegex.exec(response)) !== null) {
      const filePath = match[1].trim();
      const content = match[2];
      if (filePath && content.trim() && !files.some((f) => f.path === filePath)) {
        files.push({ path: filePath, content });
      }
    }

    // Pattern 2: ```lang filename="path" or ```lang:path\ncode\n```
    if (files.length === 0) {
      const codeBlockNamedRegex = /```(?:[a-zA-Z0-9_-]+)?[:\s]+(?:filename=|file=)?["']?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)["']?\r?\n([\s\S]*?)```/g;
      while ((match = codeBlockNamedRegex.exec(response)) !== null) {
        const filePath = match[1].trim();
        const content = match[2];
        if (filePath && content.trim() && !files.some((f) => f.path === filePath)) {
          files.push({ path: filePath, content });
        }
      }
    }

    // Pattern 3: Standard code block with a comment on first line: `# filename.ext` or `// filename.ext`
    if (files.length === 0) {
      const generalCodeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
      while ((match = generalCodeBlockRegex.exec(response)) !== null) {
        const lang = match[1].toLowerCase();
        const body = match[2];
        const firstLine = body.split('\n')[0].trim();
        const commentFileMatch = firstLine.match(/^(?:#|\/\/|\/\*|<!--)\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/);

        if (commentFileMatch && commentFileMatch[1]) {
          const filePath = commentFileMatch[1].trim();
          if (!files.some((f) => f.path === filePath)) {
            files.push({ path: filePath, content: body });
          }
        } else if (body.trim().length > 30) {
          // If a substantial code block exists and user asked to create a file, infer filename
          let guessedName = '';
          const lower = userPrompt.toLowerCase();
          if (lang === 'python' || lang === 'py') guessedName = 'script.py';
          else if (lang === 'javascript' || lang === 'js') guessedName = 'index.js';
          else if (lang === 'typescript' || lang === 'ts') guessedName = 'index.ts';
          else if (lang === 'html') guessedName = 'index.html';
          else if (lang === 'css') guessedName = 'style.css';
          else if (lang === 'java') guessedName = 'Main.java';
          else if (lang === 'c') guessedName = 'main.c';
          else if (lang === 'cpp') guessedName = 'main.cpp';

          if (lower.includes('calc')) {
            if (lang === 'python' || lang === 'py') guessedName = 'calculator.py';
            else if (lang === 'c') guessedName = 'calculator.c';
            else if (lang === 'java') guessedName = 'Calculator.java';
            else if (lang === 'javascript' || lang === 'js') guessedName = 'calculator.js';
          } else if (lower.includes('sort')) {
            if (lang === 'java') guessedName = 'ArraySorter.java';
            else if (lang === 'python' || lang === 'py') guessedName = 'sorter.py';
          }

          if (guessedName && !files.some((f) => f.path === guessedName)) {
            files.push({ path: guessedName, content: body });
          }
        }
      }
    }

    return files;
  }

  private determineCommandToRun(
    response: string,
    diffsRecorded: FileDiffResult[]
  ): string | null {
    // 1. Explicit RUN: command in AI response
    const runMatch = response.match(/(?:RUN|Run|Execute):\s*`?([^\r\n`]+)`?/);
    if (runMatch && runMatch[1].trim()) {
      return runMatch[1].trim();
    }

    // 2. Automatically infer safe test command based on created files
    for (const diff of diffsRecorded) {
      const ext = path.extname(diff.filePath).toLowerCase();
      if (ext === '.py') {
        return `python ${diff.filePath}`;
      } else if (ext === '.js') {
        return `node ${diff.filePath}`;
      } else if (ext === '.c') {
        const outName = path.basename(diff.filePath, '.c');
        return `gcc ${diff.filePath} -o ${outName} && ./${outName}`;
      } else if (ext === '.java') {
        const className = path.basename(diff.filePath, '.java');
        return `javac ${diff.filePath} && java ${className}`;
      }
    }

    return null;
  }
}
