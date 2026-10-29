# NEUTRON AI - Backend Service

This is the standalone backend service for **NEUTRON AI**, responsible for:
- **Authentication & User Management**: MongoDB Atlas with JWT sessions and bcrypt password hashing.
- **Multi-Tenant Chat Isolation**: User-scoped conversations stored in MongoDB Atlas (`conversations` collection).
- **Multi-Tenant Workspace Sandboxes**: Isolated per-user directories in `../workspace_sandbox/users/<userId>/`.
- **NVIDIA NIM LLM Provider Integration**: Real-time SSE streaming for chat and autonomous coding agent workflows.
- **Sandboxed Execution Runner**: Safe command execution with security risk assessment.

---

### Project Structure

```
backend/
├── agent/            # Autonomous coding agent orchestrator
├── execution/        # Sandbox command execution runner
├── providers/        # NVIDIA NIM API provider service with model failovers
├── security/         # Security risk analyzer for dangerous commands
├── storage/          # MongoDB Atlas multi-tenant store & local fallback
├── workspace/        # Workspace file tree, diff, and inspection manager
├── config.ts         # Environment & system configuration
├── index.ts          # Main Express 5 application and SSE endpoints
├── package.json      # Dedicated backend dependencies & scripts
├── tsconfig.json     # Dedicated backend TypeScript compiler settings
└── .env              # Backend environment variables
```

---

### Running the Backend

From the **project root**:
```bash
# Run both backend and frontend concurrently
npm run dev

# Run only the backend
npm run backend
```

Or from the **backend directory**:
```bash
cd backend
npm install
npm run dev
```

The backend server listens on `http://localhost:3001`.
