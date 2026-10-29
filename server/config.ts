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
  };
  activeModel: string;
  activeProvider: string;
  mongodbUri?: string;
  mongodbDatabase: string;
  jwtSecret: string;
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
  },
  activeModel: process.env.NVIDIA_MODEL || process.env.DEFAULT_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b',
  activeProvider: process.env.DEFAULT_PROVIDER || 'nvidia',
  mongodbUri: process.env.MONGODB_URI,
  mongodbDatabase: process.env.MONGODB_DATABASE || 'neutron',
  jwtSecret: process.env.JWT_SECRET || '',
};
