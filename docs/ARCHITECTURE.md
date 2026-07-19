# Architecture

## Components

- `src/app/page.tsx` loads public gate metadata for the user interface.
- `src/components/token-gate-app.tsx` provides the wallet and prompt workflow.
- `src/app/api/auth/nonce/route.ts` issues a short-lived SIWE message and nonce.
- `src/app/api/auth/verify/route.ts` verifies SIWE and creates the session.
- `src/app/api/auth/session/route.ts` restores an existing browser session.
- `src/app/api/auth/logout/route.ts` clears the nonce and session cookies.
- `src/app/api/chat/route.ts` checks the tctc role and calls OpenAI.
- `src/lib/auth.ts` constructs and verifies Sign-In with Ethereum messages.
- `src/lib/session.ts` signs and verifies the address-only session cookie.
- `src/lib/tctc.ts` owns the MCP stdio client and invokes `check_role`.
- `config/tctc.config.json` defines chains and token-backed roles.

## Request Flow

```text
Browser wallet
    | signed SIWE message (once)
    v
Next.js API route
    | HttpOnly address session
    v
Protected API route
    | check_role over MCP stdio
    v
tctc-mcp
    | eth_call
    v
Sepolia RPC

Next.js API route -- authorized prompt --> OpenAI Responses API
```

## Trust Boundaries

The browser is untrusted. A submitted address is accepted only after the server
verifies a SIWE message bound to the expected origin, chain, nonce, and expiry.
The nonce is short-lived and deleted after successful verification to prevent
replay.

The signed session contains identity only, expires after eight hours, and is
stored in an HttpOnly browser-session cookie. It never contains a token balance
or authorization verdict.

The OpenAI API key, session secret, and RPC URL remain in the server environment.
The server performs the tctc role check for every protected operation; UI state
and session state are never authorization decisions.

Only a valid `check_role` response with `hasRole: false` becomes an HTTP 403
denial. MCP tool errors and transport failures become HTTP 503 responses, while
malformed MCP responses become HTTP 502 responses. If the `tctc-mcp` child
process exits, its cached client is discarded and the next request starts a new
process instead of reusing the closed connection.

The MCP process is spawned from the locally installed `tctc-mcp` dependency and
receives only the environment needed for the configured chain.

## Configuration Boundary

The repository keeps authorization policy in `config/tctc.config.json` and
secrets in `.env.local`. `OPENAI_MODEL` selects one deployment-wide model; the
sample intentionally has no end-user model picker or policy administration UI.
This separation lets applications version their gate policy without committing
credentials.
