# NEUTRON AI — Intelligence in Action

An autonomous AI coding workspace and intelligent assistant powered by **NVIDIA NIM** models, **MongoDB Atlas**, and isolated sandboxes.

---

## 🏗️ Architecture

```
NEUTRON/
├── backend/                  # 🟢 Standalone Backend Service (Express 5, MongoDB, NVIDIA NIM)
│   ├── agent/               # Autonomous coding agent orchestrator
│   ├── execution/           # Sandboxed command execution runner
│   ├── providers/           # NVIDIA NIM API provider & failover model queue
│   ├── security/            # Security risk analyzer for safe operations
│   ├── storage/             # MongoDB Atlas multi-tenant store
│   ├── workspace/           # Workspace manager & diff tools
│   ├── config.ts            # Backend configuration loader
│   ├── index.ts             # Express application and SSE streaming routes
│   └── package.json         # Dedicated backend dependencies
│
├── client/                   # 🔵 Standalone Frontend (React 19, Vite, Lucide)
│   ├── src/                 # Modern glassmorphism UI & components
│   ├── package.json         # Dedicated client dependencies
│   └── vite.config.ts       # Vite configuration with API proxy to port 3001
│
├── workspace_sandbox/        # 📦 User-isolated environments (users/<userId>/)
└── package.json              # ⚡ Monorepo coordinator
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v18+
- **MongoDB Atlas** cluster URI
- **NVIDIA NIM API Key**

### 2. Configuration
Copy `.env.example` to `.env` (or `backend/.env`):
```env
PORT=3001
MONGODB_URI=your_mongodb_atlas_uri
MONGODB_DATABASE=neutron
JWT_SECRET=your_jwt_secret_key
NVIDIA_API_KEY=your_nvidia_api_key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
```

### 3. Install & Run
```bash
# Install root, backend, and client dependencies
npm install
npm run dev --prefix backend
npm run dev --prefix client

# Or run both simultaneously from the project root:
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## 🔒 Features & Privacy
- **Multi-Tenant User Isolation**: Every registered account has private chats and an isolated filesystem environment.
- **NVIDIA NIM LLMs**: Fast inference with multi-model failover support.
- **Autonomous Coding Agent**: Inspects project files, creates unified diffs, runs test suites, and verifies execution safely.
- **Sandbox Security Guards**: Rejects dangerous commands and isolates user file modifications.
