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
- **[RAG Agent](./apps/react-nextjs-knowledge-agent/)** - A knowledge agent implementation using RAG (Retrieval-Augmented Generation) with StackOne integrations


## Languages

- **TypeScript** - All examples are written in TypeScript
- **JavaScript/Node.js** - Runtime environment for all examples

## Repository structure

```
examples/
├── apps/                    # Example applications
│   ├── oauth-redirect-proxy/    # OAuth redirect proxy example
│   └── react-nextjs-knowledge-agent/  # RAG agent example
├── packages/                # Shared configuration packages
│   ├── eslint-config/       # Shared ESLint configurations
│   └── typescript-config/   # Shared TypeScript configurations
├── package.json             # Root package.json (Turborepo config)
└── turbo.json              # Turborepo task configuration
```

Each app is **independent** and manages its own dependencies. There is no shared `package-lock.json` at the root level.

## Prerequisites

- **Node.js** >= 18 (see [engines](./package.json#L16) in package.json)
- **npm** >= 10.9.2 (or compatible package manager)
- **StackOne account** - Sign up at [stackone.com](https://stackone.com) to get your API credentials




## Getting Started

Install dependencies for a specific app:

```bash
cd apps/<app-name>
npm install
```

Run development commands from the root:

```bash
npm run dev    # Run all apps
npm run build  # Build all apps
npm run lint   # Lint all apps
```

## Related documentation

- **[StackOne Documentation](https://docs.stackone.com)** - Complete API reference and integration guides
- **[StackOne Integration Gateway](https://stackone.com)** - Learn more about StackOne's platform
- **[OAuth Proxy Redirect Guide](https://docs.stackone.com/integration-guides/oauth-proxy-redirect)** - Detailed guide for OAuth redirect proxy setup

