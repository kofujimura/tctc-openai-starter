# tctc OpenAI Token Gate

A standalone Next.js reference application that protects an OpenAI API route with
on-chain token ownership verified by
[tctc-mcp](https://github.com/kofujimura/tctc-mcp).

The included configuration grants `OPENAI_CALLER_ROLE` to wallets holding ERC-1155
token ID `2` from the sample Sepolia contract. Replace that rule with your own
contract before deploying the application.

## Quick Start

Requirements:

- Node.js 20 or newer
- An injected EVM wallet such as MetaMask
- A Sepolia RPC endpoint
- An OpenAI API key

```bash
git clone https://github.com/kofujimura/tctc-openai-token-gate.git
cd tctc-openai-token-gate
npm install
cp .env.local.example .env.local
npm run dev
```

Set the real credentials in `.env.local`, then open <http://localhost:3000>.

Generate the session signing secret with:

```bash
openssl rand -base64 32
```

## Configuration

Environment variables are server-side unless explicitly documented otherwise.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Authenticates server requests to OpenAI |
| `SEPOLIA_RPC_URL` | Yes | Reads token ownership from Sepolia |
| `OPENAI_MODEL` | No | Selects the OpenAI model; defaults to `gpt-4.1-mini` |
| `SESSION_SECRET` | Yes | Signs the wallet ownership session; use at least 32 random characters |

### Policy and runtime configuration

The same application operator normally manages both `config/tctc.config.json`
and `.env.local`, but they are separated because they have different security
and change-management requirements:

- `config/tctc.config.json` is the version-controlled authorization policy. It
  defines the chain, contract, token ID, and role that determine who may pass the
  gate. Keeping it in Git makes policy changes reviewable and also demonstrates
  the native configuration format consumed by `tctc-mcp`.
- `.env.local` contains secrets and deployment-specific runtime values, such as
  the OpenAI API key, session secret, RPC endpoint, and selected model. It must
  remain outside Git and can differ between development, staging, and production.

The policy refers to the RPC endpoint through an environment variable rather
than embedding it directly:

```json
{
  "rpcUrl": "${SEPOLIA_RPC_URL}"
}
```

This boundary is based on sensitivity and lifecycle, not on the files having
different owners. The deploying operator is distinct from the wallet subject
whose token ownership is checked on each protected request.

The gate policy lives in [`config/tctc.config.json`](config/tctc.config.json). The
default rule checks ERC-1155 token ID `2` at
`0x3423816644f557f6d14B28735bd5af45f2679E8a` on Sepolia.

Do not commit `.env.local`. `OPENAI_API_KEY` is read only by the server route and
must never use a `NEXT_PUBLIC_` prefix.

## How Authorization Works

1. The browser asks the wallet to sign a short-lived Sign-In with Ethereum message.
2. The API verifies the domain, URI, chain, nonce, expiry, and wallet signature.
3. The server issues a signed, HttpOnly browser-session cookie containing the address.
4. Each protected request calls the `check_role` tool exposed by `tctc-mcp` over MCP stdio.
5. `tctc-mcp` evaluates `OPENAI_CALLER_ROLE` using the current on-chain policy.
6. The server calls OpenAI only when the fresh role result contains `hasRole: true`.

The wallet signature is required once per browser session, up to an absolute limit
of eight hours. `Disconnect token gate`, a wallet account change, or a wallet
network change clears the local session. Token authorization is never cached in
the session, so transferring or burning the required token affects the next call.

The OpenAI API key and the Sepolia RPC URL are never returned to the browser.

## Repository Layout

```text
config/                 tctc-mcp authorization policy
docs/                   architecture and maintenance notes
src/app/                Next.js page and protected API routes
src/components/         Wallet and prompt user interface
src/lib/                wallet authentication and tctc-mcp client
.github/workflows/      continuous integration
```

See [Architecture](docs/ARCHITECTURE.md) for the trust boundaries and request
flow. Security reports should follow [SECURITY.md](SECURITY.md).

## Development

```bash
npm run typecheck
npm run build
```

`npm run check` runs both commands. Pull requests should keep the example focused
on demonstrating token-gated application integration with `tctc-mcp`.

## License

Apache-2.0
