# Contributing

## Local Setup

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.local.example` to `.env.local` and provide local credentials.
4. Run `npm run dev`.

Before opening a pull request, run:

```bash
npm run check
```

## Scope

This repository is a focused reference implementation for integrating a Next.js
application with `tctc-mcp`. Keep changes understandable to developers using the
repository as a template. General MCP server behavior belongs in the
[`tctc-mcp` repository](https://github.com/kofujimura/tctc-mcp).

Do not commit API keys, wallet secrets, RPC credentials, or populated local
environment files.
