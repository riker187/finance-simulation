# Contributing to Finance Simulation

Thank you for your interest in contributing!
This document explains how to get started, how to report issues, and how to submit changes.

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for the full stack)
- Git

### Local Setup

```bash
git clone https://github.com/riker187/finance-simulation.git
cd finance-simulation
cp .env.example .env
npm install
npm run dev        # Vite dev server on :5173 (proxies sync to :8787)
```

Start the sync server separately (optional for real-time sync):
```bash
node sync-server/server.js
```

Or run the full stack via Docker:
```bash
docker compose up
```

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/riker187/finance-simulation/issues) first.
2. Open a new issue with:
   - A clear title
   - Steps to reproduce
   - Expected vs. actual behaviour
   - Browser and OS

### Suggesting Features

Open an issue with the label `enhancement`.
Describe the use case — not just the solution.

### Submitting a Pull Request

1. Fork the repository and create a branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Make your changes. Keep commits focused and atomic.
3. Ensure the app builds without errors:
   ```bash
   npm run build
   ```
4. Open a pull request against `main` with a clear description of what changed and why.

## Code Style

- TypeScript everywhere (no `any` unless unavoidable)
- React functional components with hooks
- Tailwind CSS for styling — avoid inline styles except for dynamic values
- No new dependencies without discussion — the bundle size matters for a self-hosted tool
- Keep components small and focused

## Project Structure

```
src/
  components/   React UI components
  utils/        Pure utility functions (no React)
  store.ts      Zustand state + all mutations
  simulation.ts Financial simulation logic
  realtime.ts   Server-Sent Events sync hook
  types.ts      Shared TypeScript interfaces
sync-server/
  server.js     Minimal Node.js sync server (no framework)
```

## Security

Please read [SECURITY.md](SECURITY.md) before reporting any security-related issues.
