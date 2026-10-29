import { config } from '../config';

export interface StreamCallbacks { onChunk: (text: string) => void; onError?: (err: Error) => void; onDone?: () => void; }
export interface ModelMessage { role: 'user' | 'assistant' | 'system'; content: string; }
export interface ModelProviderInfo { id: string; name: string; models: Array<{ id: string; name: string; description: string }>; isConfigured: boolean; }

export const DEFAULT_NVIDIA_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

export class AIProviderService {
  static getProviders(): ModelProviderInfo[] {
    return [{ id: 'nvidia', name: 'NVIDIA NIM', isConfigured: !!config.providers.nvidiaApiKey, models: [{ id: DEFAULT_NVIDIA_MODEL, name: 'Nemotron 3 Nano Omni 30B (Reasoning)', description: 'NEUTRON’s only available model.' }] }];
  }

  static async streamCompletion(messages: ModelMessage[], systemPrompt: string, _provider: string, _model: string, callbacks: StreamCallbacks): Promise<string> {
    const apiKey = config.providers.nvidiaApiKey;
    if (!apiKey) throw new Error('NVIDIA_API_KEY is not configured. Add it to the server environment and restart the service.');
    const response = await fetch(`${(config.providers.nvidiaBaseUrl || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: DEFAULT_NVIDIA_MODEL, messages: [{ role: 'system', content: systemPrompt }, ...messages.filter((message) => message.content.trim())], temperature: 0.2, max_tokens: 4096, stream: true }),
    });
    if (!response.ok) throw new Error(`NVIDIA NIM API error (${response.status}): ${await response.text()}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('NVIDIA NIM returned no readable stream.');
    const decoder = new TextDecoder();
    let buffer = '', output = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        const data = JSON.parse(payload);
        if (data.error) throw new Error(data.error.message || String(data.error));
        const content = data.choices?.[0]?.delta?.content || '';
        if (content) { output += content; callbacks.onChunk(content); }
      }
    }
    if (!output.trim()) throw new Error('NVIDIA NIM returned an empty response.');
    callbacks.onDone?.();
    return output;
  }
}
