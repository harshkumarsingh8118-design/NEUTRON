import { config } from '../config';

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
}

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelProviderInfo {
  id: string;
  name: string;
  models: Array<{ id: string; name: string; description: string }>;
  isConfigured: boolean;
}

export const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

// Validated models on NVIDIA NIM that are active and available for this account
export const NVIDIA_WORKING_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
];

export class AIProviderService {
  /**
   * Returns list of supported providers and their models
   */
  static getProviders(): ModelProviderInfo[] {
    return [
      {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        isConfigured: !!config.providers.nvidiaApiKey,
        models: [
          {
            id: 'nvidia/nemotron-3-ultra-550b-a55b',
            name: 'Nemotron 3 Ultra 550B (Frontier Reasoning)',
            description: 'NVIDIA frontier reasoning model for complex software architecture and deep reasoning.',
          },
          {
            id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
            name: 'Nemotron 3.5 Lightning 30B (Ultra-Fast)',
            description: 'High-speed reasoning model tuned by NVIDIA for fast interactive chat and coding.',
          },
          {
            id: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
            name: 'Nemotron 3.5 Super VL 120B (Multimodal)',
            description: 'Advanced omni reasoning and multimodal capabilities for full-stack engineering.',
          },
          {
            id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
            name: 'Nemotron 3 Nano Omni 30B (Reasoning)',
            description: 'Compact reasoning model with explicit chain-of-thought omni capabilities.',
          },
        ],
      },
      {
        id: 'neutron-builtin',
        name: 'NEUTRON Built-in Engine',
        isConfigured: true,
        models: [
          {
            id: 'neutron-core-agent',
            name: 'NEUTRON Autonomous Core',
            description: 'Local autonomous reasoning engine (offline fallback).',
          },
        ],
      },
    ];
  }

  /**
   * Streams a completion from the chosen provider
   */
  static async streamCompletion(
    messages: ModelMessage[],
    systemPrompt: string,
    provider: string,
    model: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const activeProvider = provider || config.activeProvider || 'nvidia';
    const activeModel = model || config.activeModel || DEFAULT_NVIDIA_MODEL;

    // Filter out messages with empty content to prevent provider validation errors
    const validMessages = messages.filter((m) => m.content && m.content.trim().length > 0);

    if (activeProvider === 'nvidia' && config.providers.nvidiaApiKey) {
      try {
        return await this.streamNvidiaWithFailover(validMessages, systemPrompt, activeModel, callbacks);
      } catch (err: any) {
        console.error('[NEUTRON AI] NVIDIA NIM error after all retries/failovers:', err.message);
        const notice = `> ⚠️ **NVIDIA NIM Notice**: ${err.message}. *Falling back to NEUTRON Built-in Engine:*\n\n---\n\n`;
        callbacks.onChunk(notice);
        const fallbackText = await this.streamBuiltin(validMessages, systemPrompt, callbacks);
        return notice + fallbackText;
      }
    }

    if (!config.providers.nvidiaApiKey) {
      const notice = '> ⚠️ **NVIDIA API Key Required**:\n> Please set `NVIDIA_API_KEY` in `.env` or open Settings (gear icon) to configure your NVIDIA NIM credentials.\n\n---\n\n';
      callbacks.onChunk(notice);
      const fallbackText = await this.streamBuiltin(validMessages, systemPrompt, callbacks);
      return notice + fallbackText;
    }

    return this.streamBuiltin(validMessages, systemPrompt, callbacks);
  }

  /**
   * Streams from NVIDIA NIM with automatic model failover if worker limit (503) or not found (404) occurs
   */
  private static async streamNvidiaWithFailover(
    messages: ModelMessage[],
    systemPrompt: string,
    preferredModel: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const apiKey = config.providers.nvidiaApiKey;
    if (!apiKey) throw new Error('NVIDIA API Key is missing');

    const baseUrl = (config.providers.nvidiaBaseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    // Prioritize preferred model, followed by the known working models
    const candidateModels = Array.from(new Set([preferredModel, ...NVIDIA_WORKING_MODELS]));
    let lastError: Error | null = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
      try {
        return await this.streamNvidiaSingleModel(messages, systemPrompt, currentModel, apiKey, url, callbacks);
      } catch (err: any) {
        lastError = err;
        const msg = err.message || '';
        const isWorkerBusy = msg.includes('503') || msg.includes('ResourceExhausted') || msg.includes('429');
        const isNotFound = msg.includes('404') || msg.includes('Not Found');

        if ((isWorkerBusy || isNotFound) && i < candidateModels.length - 1) {
          const nextModel = candidateModels[i + 1];
          console.warn(`[NVIDIA NIM] Model ${currentModel} error (${msg}). Auto-failing over to ${nextModel}...`);
          continue;
        }

        // If it's an auth error (401/403) or no more candidates, rethrow
        throw err;
      }
    }

    throw lastError || new Error('Failed to connect to NVIDIA NIM');
  }

  /**
   * Executes a streaming request for a single NVIDIA model with retry logic
   */
  private static async streamNvidiaSingleModel(
    messages: ModelMessage[],
    systemPrompt: string,
    modelName: string,
    apiKey: string,
    url: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const maxAttempts = 2;
    let response: Response | null = null;
    let lastErr: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: formattedMessages,
            temperature: 0.2,
            max_tokens: 4096,
            stream: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          break;
        }

        const errText = await response.text();
        if ((response.status === 503 || response.status === 429) && attempt < maxAttempts) {
          console.warn(`[NVIDIA NIM] Worker busy (${response.status}) on ${modelName}, retrying in 1s...`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        throw new Error(`NVIDIA NIM API error (${response.status}): ${errText}`);
      } catch (err: any) {
        lastErr = err;
        if (err.name === 'AbortError') {
          throw new Error(`NVIDIA NIM request timed out after 35s for model ${modelName}`);
        }
        if (attempt < maxAttempts && !err.message?.includes('401') && !err.message?.includes('403') && !err.message?.includes('404')) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw err;
      }
    }

    if (!response || !response.ok) {
      throw lastErr || new Error(`Failed response from NVIDIA NIM for model ${modelName}`);
    }

    return this.readNvidiaStream(response, callbacks);
  }

  /**
   * SSE reader for NVIDIA NIM with support for both reasoning_content and content deltas,
   * plus detection of in-stream error payloads.
   */
  private static async readNvidiaStream(response: Response, callbacks: StreamCallbacks): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream from NVIDIA NIM API');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let inReasoning = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);

            // Check for in-stream error object returned by NVIDIA NIM
            if (data.error) {
              const errMsg = typeof data.error === 'string'
                ? data.error
                : data.error.message || JSON.stringify(data.error);
              throw new Error(`NVIDIA stream error: ${errMsg}`);
            }

            const delta = data.choices?.[0]?.delta;
            if (!delta) continue;

            // Handle reasoning delta (chain-of-thought from Nemotron reasoning models)
            if (delta.reasoning_content) {
              if (!inReasoning) {
                inReasoning = true;
                const header = '> 🧠 **Thinking Process:**\n> ';
                fullText += header;
                callbacks.onChunk(header);
              }
              const formattedReasoning = delta.reasoning_content.replace(/\n/g, '\n> ');
              fullText += formattedReasoning;
              callbacks.onChunk(formattedReasoning);
            }

            // Handle standard content delta
            if (delta.content) {
              if (inReasoning) {
                inReasoning = false;
                const separator = '\n\n---\n\n';
                fullText += separator;
                callbacks.onChunk(separator);
              }
              fullText += delta.content;
              callbacks.onChunk(delta.content);
            }
          } catch (parseErr: any) {
            if (parseErr.message?.startsWith('NVIDIA stream error:')) {
              throw parseErr;
            }
            // Ignore incomplete SSE chunk JSON parse errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // If stream ended while still in reasoning block, close it cleanly
    if (inReasoning) {
      const separator = '\n\n---\n\n';
      fullText += separator;
      callbacks.onChunk(separator);
    }

    if (!fullText.trim()) {
      throw new Error('NVIDIA NIM returned an empty response. Worker may have terminated early.');
    }

    callbacks.onDone?.();
    return fullText;
  }

  /**
   * Built-in fallback engine for offline or unconfigured states.
   * Generates helpful, structured conversational responses without crashing.
   */
  private static async streamBuiltin(
    messages: ModelMessage[],
    _systemPrompt: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || 'Hello';
    const lower = lastUserMsg.toLowerCase().trim();

    let reply = '';

    if (/^(hi|hello|hey|greetings|howdy|sup)\b/i.test(lower)) {
      reply = `Hey there! 👋 I am **NEUTRON**, your AI companion and coding partner.\n\nHow can I help you today? You can ask me questions, paste code for review, or use the **Coding Agent** mode to build and execute projects in your workspace.`;
    } else if (lower.includes('who are you') || lower.includes('about you') || lower.includes('what can you do')) {
      reply = `I am **NEUTRON**, an intelligent software engineering partner and AI assistant powered by **NVIDIA NIM**.\n\n### What I Can Do:\n- **Conversational Assistant**: Answer questions, explain concepts, and brainstorm architecture.\n- **Autonomous Coding Agent**: Inspect your workspace files, generate production code with diffs, and run verification commands in a sandbox.\n- **NVIDIA AI Models**: Powered by NVIDIA's frontier Nemotron reasoning models.\n\nFeel free to ask a technical question or tell me what you'd like to build!`;
    } else if (lower.includes('python') || lower.includes('code') || lower.includes('javascript') || lower.includes('function')) {
      reply = `Here is how you can approach that:\n\n\`\`\`python\n# Example implementation\ndef solve():\n    print("Ready to implement solution in workspace.")\n\nif __name__ == "__main__":\n    solve()\n\`\`\`\n\nTo have me automatically generate, edit, and run this code in your project workspace, switch to **Coding agent** mode in the top header.`;
    } else {
      reply = `I received your request: *"${lastUserMsg.slice(0, 100)}"*.\n\nTo get live AI responses powered by NVIDIA NIM, please ensure your \`NVIDIA_API_KEY\` is active in \`.env\` or configured in the **Settings** modal.`;
    }

    // Stream the built-in reply smoothly
    const words = reply.split(' ');
    for (const word of words) {
      callbacks.onChunk(word + ' ');
      await new Promise((r) => setTimeout(r, 15));
    }

    callbacks.onDone?.();
    return reply;
  }
}
