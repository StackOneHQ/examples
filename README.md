# StackOne - Examples

Official code examples showing how to integrate with the StackOne Integration Gateway to develop integrated agents.

This repository contains **minimal, production-oriented examples** for common StackOne use cases.

**This repo is for:**
- Developers evaluating StackOne
- Customers building their first integration
- Reference implementations for specific integration flows

**This repo is not:**
- A full SDK
- A framework or boilerplate
- An exhaustive API reference


## Examples included

- **[OAuth Redirect Proxy](./apps/oauth-redirect-proxy/)** - A custom domain proxy for OAuth redirects that forwards callbacks to StackOne, solving the need for verified domains in OAuth app configurations
- **[Context-Aware Agent Playground](./apps/rag-knowledge-agent/)** - A context-aware agent playground implementation using RAG (Retrieval-Augmented Generation), realtime StackOne actions & webhooks for efficient RAG re-indexing


## Languages

- **TypeScript** - All examples are written in TypeScript
- **JavaScript/Node.js** - Runtime environment for all examples

## Repository structure

```
examples/
├── apps/                    # Example applications (each runs in isolation)
│   ├── oauth-redirect-proxy/     # OAuth redirect proxy example
│   └── rag-knowledge-agent/      # Context-Aware Agent Playground
├── packages/                # Optional shared config (eslint, typescript)
│   ├── eslint-config/
│   └── typescript-config/
└── README.md
```

This repository uses **Turborepo** for monorepo management. Each app is independent but shares build tooling and can be managed from the root.

## Prerequisites

- **Node.js** >= 18
- **npm** (or compatible package manager)
- **StackOne account** - Sign up at [stackone.com](https://stackone.com) to get your API credentials

## Getting Started

### Option 1: Using Turborepo (Recommended)

From the repository root:

```bash
# Install all dependencies
npm install

# Run all apps in development mode
npm run dev

# Build all apps
npm run build

# Lint all apps
npm run lint
```

### Option 2: Run Individual Apps

You can still run commands from individual app directories:

```bash
cd apps/rag-knowledge-agent
npm install
npm run dev
```

Or use Turborepo to run a specific app:

```bash
# From root directory
turbo run dev --filter=rag-knowledge-agent
turbo run build --filter=oauth-redirect-proxy
```

## Related documentation

- **[StackOne Documentation](https://docs.stackone.com)** - Complete API reference and integration guides
- **[StackOne Integration Gateway](https://stackone.com)** - Learn more about StackOne's platform
- **[OAuth Proxy Redirect Guide](https://docs.stackone.com/integration-guides/oauth-proxy-redirect)** - Detailed guide for OAuth redirect proxy setup
