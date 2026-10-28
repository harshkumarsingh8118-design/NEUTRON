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

export class AIProviderService {
  /**
   * Returns list of supported providers and their configuration status
   */
  static getProviders(): ModelProviderInfo[] {
    return [
      {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        isConfigured: !!config.providers.nvidiaApiKey,
        models: [
          { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', name: 'Nemotron 3 Nano Omni 30B (Reasoning)', description: 'NVIDIA reasoning model with chain-of-thought omni capabilities' },
          { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', description: 'High-capability instruction model tuned by NVIDIA for complex coding & reasoning' },
          { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B Instruct', description: 'Frontier scale reasoning model for enterprise coding tasks' },
          { id: 'deepseek-ai/deepseek-v4.1-flash', name: 'DeepSeek v4.1 Flash (NVIDIA NIM)', description: 'Ultra-fast inference speed via NVIDIA NIM architecture' },
        ],
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: !!config.providers.geminiApiKey,
        models: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Ultra-fast, high capability model for code & reasoning' },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Extended context window and deep analytical reasoning' },
          { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-gen multimodal reasoning model' },
        ],
      },
      {
        id: 'openai',
        name: 'OpenAI',
        isConfigured: !!config.providers.openaiApiKey,
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', description: 'High-intelligence flagship model for multimodal and coding tasks' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and lightweight model' },
        ],
      },
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        isConfigured: !!config.providers.anthropicApiKey,
        models: [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Industry benchmark for software engineering and nuanced logic' },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Ultra-fast responsive coding assistant' },
        ],
      },
      {
        id: 'groq',
        name: 'Groq',
        isConfigured: !!config.providers.groqApiKey,
        models: [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', description: 'Extreme inference speed on Groq LPUs' },
        ],
      },
      {
        id: 'ollama',
        name: 'Local Ollama',
        isConfigured: true,
        models: [
          { id: 'llama3:latest', name: 'Llama 3 (Local)', description: 'Locally hosted model via Ollama instance' },
          { id: 'codellama:latest', name: 'CodeLlama (Local)', description: 'Specialized code generation model' },
          { id: 'deepseek-coder:latest', name: 'DeepSeek Coder (Local)', description: 'Advanced open-weight coding model' },
        ],
      },
      {
        id: 'neutron-builtin',
        name: 'NEUTRON Built-in Engine',
        isConfigured: true,
        models: [
          { id: 'neutron-core-agent', name: 'NEUTRON Autonomous Core', description: 'Local autonomous reasoning & verification engine (No API key required)' },
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
    let activeProvider = provider || config.activeProvider;
    let activeModel = model || config.activeModel;

    // Prefer NVIDIA NIM if configured or if client requested builtin/default
    if ((activeProvider === 'neutron-builtin' || !activeProvider) && config.providers.nvidiaApiKey) {
      activeProvider = 'nvidia';
      activeModel = config.activeModel || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
    }

    // Check if provider is configured, otherwise fallback to builtin
    if (activeProvider === 'nvidia' && config.providers.nvidiaApiKey) {
      try {
        return await this.streamNvidia(
          messages,
          systemPrompt,
          activeModel,
          config.providers.nvidiaApiKey,
          config.providers.nvidiaBaseUrl || 'https://integrate.api.nvidia.com/v1',
          callbacks
        );
      } catch (err: any) {
        console.error('[NEUTRON AI] NVIDIA NIM error:', err.message);
        callbacks.onChunk(`> ⚠️ **NVIDIA NIM Notice**: ${err.message}. *Falling back to NEUTRON Built-in Engine:*\n\n---\n\n`);
        return this.streamBuiltin(messages, systemPrompt, callbacks);
      }
    } else if (activeProvider === 'gemini' && config.providers.geminiApiKey) {
      try {
        return await this.streamGemini(messages, systemPrompt, activeModel, config.providers.geminiApiKey, callbacks);
      } catch (err: any) {
        console.error('[NEUTRON AI] Gemini error:', err.message);
        callbacks.onChunk(`> ⚠️ **Gemini Notice**: ${err.message}. *Falling back to NEUTRON Built-in Engine:*\n\n---\n\n`);
        return this.streamBuiltin(messages, systemPrompt, callbacks);
      }
    } else if (activeProvider === 'openai' && config.providers.openaiApiKey) {
      try {
        return await this.streamOpenAI(messages, systemPrompt, activeModel, config.providers.openaiApiKey, callbacks);
      } catch (err: any) {
        console.error('[NEUTRON AI] OpenAI Provider error:', err.message);
        const isQuota = err.message?.includes('429') || err.message?.includes('insufficient_quota') || err.message?.includes('credit_balance_exhausted');
        const notice = isQuota
          ? `> ⚠️ **OpenAI Quota Notice**: Your OpenAI API account has exhausted its credit balance (Error 429). [Add credits at OpenAI Billing](https://platform.openai.com/settings/organization/billing/).\n> *Responding using NEUTRON Built-in Engine:*\n\n---\n\n`
          : `> ⚠️ **OpenAI Notice**: ${err.message}. *Responding using NEUTRON Built-in Engine:*\n\n---\n\n`;
        callbacks.onChunk(notice);
        const fallbackText = await this.streamBuiltin(messages, systemPrompt, callbacks);
        return notice + fallbackText;
      }
    } else if (activeProvider === 'anthropic' && config.providers.anthropicApiKey) {
      try {
        return await this.streamAnthropic(messages, systemPrompt, activeModel, config.providers.anthropicApiKey, callbacks);
      } catch (err: any) {
        console.error('[NEUTRON AI] Anthropic error:', err.message);
        callbacks.onChunk(`> ⚠️ **Anthropic Notice**: ${err.message}. *Falling back to NEUTRON Built-in Engine:*\n\n---\n\n`);
        return this.streamBuiltin(messages, systemPrompt, callbacks);
      }
    } else if (activeProvider === 'groq' && config.providers.groqApiKey) {
      try {
        return await this.streamGroq(messages, systemPrompt, activeModel, config.providers.groqApiKey, callbacks);
      } catch (err: any) {
        console.error('[NEUTRON AI] Groq error:', err.message);
        callbacks.onChunk(`> ⚠️ **Groq Notice**: ${err.message}. *Falling back to NEUTRON Built-in Engine:*\n\n---\n\n`);
        return this.streamBuiltin(messages, systemPrompt, callbacks);
      }
    } else if (activeProvider === 'ollama') {
      try {
        return await this.streamOllama(messages, systemPrompt, activeModel, callbacks);
      } catch {
        // Fallback to builtin if Ollama is not running locally
      }
    }

    // Built-in intelligent engine fallback
    return this.streamBuiltin(messages, systemPrompt, callbacks);
  }

  /**
   * Gemini Streaming implementation using official REST API
   */
  private static async streamGemini(
    messages: ModelMessage[],
    systemPrompt: string,
    model: string,
    apiKey: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const modelName = model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream from Gemini API');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunk) {
              fullText += chunk;
              callbacks.onChunk(chunk);
              await new Promise((r) => setTimeout(r, 30));
            }
          } catch {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }

    if (callbacks.onDone) callbacks.onDone();
    return fullText;
  }

  /**
   * OpenAI Streaming implementation
   */
  private static async streamOpenAI(
    messages: ModelMessage[],
    systemPrompt: string,
    model: string,
    apiKey: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
    }

    return this.readSSEStream(response, callbacks);
  }

  /**
   * Groq Streaming implementation
   */
  private static async streamGroq(
    messages: ModelMessage[],
    systemPrompt: string,
    model: string,
    apiKey: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API Error (${response.status}): ${errText}`);
    }

    return this.readSSEStream(response, callbacks);
  }

  /**
   * Anthropic Streaming implementation
   */
  private static async streamAnthropic(
    messages: ModelMessage[],
    systemPrompt: string,
    model: string,
    apiKey: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages';
    const formattedMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        system: systemPrompt,
        messages: formattedMessages,
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No stream available');
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const json = line.slice(6).trim();
          try {
            const parsed = JSON.parse(json);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              const chunk = parsed.delta.text;
              fullText += chunk;
              callbacks.onChunk(chunk);
            }
          } catch {}
        }
      }
    }

    if (callbacks.onDone) callbacks.onDone();
    return fullText;
  }

  /**
   * Ollama streaming
   */
  private static async streamOllama(
    messages: ModelMessage[],
    systemPrompt: string,
    model: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const url = `${config.providers.ollamaBaseUrl || 'http://localhost:11434'}/api/chat`;
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3:latest',
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama Error (${response.status})`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No stream');
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const chunk = parsed.message?.content || '';
          if (chunk) {
            fullText += chunk;
            callbacks.onChunk(chunk);
          }
        } catch {}
      }
    }

    if (callbacks.onDone) callbacks.onDone();
    return fullText;
  }

  /**
   * NVIDIA NIM Streaming implementation with chain-of-thought omni-reasoning support
   */
  private static async streamNvidia(
    messages: ModelMessage[],
    systemPrompt: string,
    model: string,
    apiKey: string,
    baseUrl: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const modelName = model || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
    let response: Response | null = null;
    let lastError: Error | null = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
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
        });

        if (response.ok) {
          break;
        }

        const errText = await response.text();
        if ((response.status === 503 || response.status === 429) && attempt < maxAttempts) {
          console.warn(`[NVIDIA NIM] Worker busy/rate-limit (${response.status}) on attempt ${attempt}/${maxAttempts}. Retrying in 1.5s...`);
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }

        throw new Error(`NVIDIA NIM API Error (${response.status}): ${errText}`);
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts && !err.message?.includes('401') && !err.message?.includes('403')) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error('Failed to connect to NVIDIA NIM');
    }

    return this.readNvidiaStream(response, callbacks);
  }

  /**
   * SSE reader for NVIDIA NIM with support for both reasoning_content and content deltas
   */
  private static async readNvidiaStream(response: Response, callbacks: StreamCallbacks): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream from NVIDIA NIM API');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';
    let inReasoning = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta;
            if (!delta) continue;

            // Handle reasoning delta (e.g. from Nemotron reasoning models)
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
          } catch {
            // Ignore parse errors on incomplete chunks
          }
        }
      }
    }

    if (callbacks.onDone) callbacks.onDone();
    return fullText;
  }

  /**
   * Generic SSE reader for OpenAI format
   */
  private static async readSSEStream(response: Response, callbacks: StreamCallbacks): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream from API');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const chunk = data.choices?.[0]?.delta?.content || data.choices?.[0]?.delta?.reasoning_content || '';
            if (chunk) {
              fullText += chunk;
              callbacks.onChunk(chunk);
              await new Promise((r) => setTimeout(r, 25));
            }
          } catch {}
        }
      }
    }

    if (callbacks.onDone) callbacks.onDone();
    return fullText;
  }

  /**
   * Built-in fallback engine - routes to NVIDIA NIM if available
   */
  private static async streamBuiltin(
    messages: ModelMessage[],
    systemPrompt: string,
    callbacks: StreamCallbacks
  ): Promise<string> {
    if (config.providers.nvidiaApiKey) {
      return this.streamNvidia(
        messages,
        systemPrompt,
        config.activeModel || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
        config.providers.nvidiaApiKey,
        config.providers.nvidiaBaseUrl || 'https://integrate.api.nvidia.com/v1',
        callbacks
      );
    }

    const notice = `⚠️ **No Active AI Provider Configured**\n\nPlease configure your **NVIDIA API Key** in \`.env\` or the Settings panel to receive live responses from \`${config.activeModel}\`.`;
    callbacks.onChunk(notice);
    if (callbacks.onDone) callbacks.onDone();
    return notice;
  }
}
