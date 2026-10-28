import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface ServerConfig {
  port: number;
  defaultWorkspaceDir: string;
  allowedWorkspaceRoots: string[];
  commandTimeoutMs: number;
  maxOutputBytes: number;
  providers: {
    nvidiaApiKey?: string;
    nvidiaBaseUrl?: string;
    nvidiaModel?: string;
    geminiApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    groqApiKey?: string;
    ollamaBaseUrl?: string;
  };
  activeModel: string;
  activeProvider: string;
}

const DEFAULT_WORKSPACE = path.resolve(process.cwd(), 'workspace_sandbox');

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  defaultWorkspaceDir: process.env.WORKSPACE_DIR ? path.resolve(process.env.WORKSPACE_DIR) : DEFAULT_WORKSPACE,
  allowedWorkspaceRoots: [
    path.resolve(process.cwd()),
    DEFAULT_WORKSPACE,
  ],
  commandTimeoutMs: parseInt(process.env.COMMAND_TIMEOUT_MS || '25000', 10),
  maxOutputBytes: 500 * 1024, // 500 KB limit
  providers: {
    nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
    nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    nvidiaModel: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    groqApiKey: process.env.GROQ_API_KEY || '',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  },
  activeModel: process.env.DEFAULT_MODEL || (process.env.NVIDIA_MODEL || (process.env.NVIDIA_API_KEY ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' : 'gemini-2.5-flash')),
  activeProvider: process.env.DEFAULT_PROVIDER || (process.env.NVIDIA_API_KEY ? 'nvidia' : 'gemini'),
};
