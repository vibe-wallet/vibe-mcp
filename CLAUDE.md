# Vibe Wallet MCP Server

MCP server that bridges AI agents (Claude, OpenCode) to the Vibe Wallet Chrome extension. AI clients connect via SSE, the extension connects via WebSocket, and the server pairs them by IP address.

## Tech Stack

- Express (HTTP + SSE transport)
- WebSocket (ws) for Chrome extension communication
- @modelcontextprotocol/sdk for MCP protocol
- TypeScript, Vitest for testing

## Key Commands

```bash
pnpm dev          # tsx watch src/index.ts (hot reload)
pnpm build        # tsc
pnpm start        # node dist/index.js
pnpm test         # vitest run (44 E2E tests)
pnpm test:watch   # vitest (watch mode)
```

## Architecture

Single-file server: `src/index.ts`. Express handles HTTP + SSE, ws handles WebSocket connections.

### IP-Based Pairing

Four core data structures drive the pairing logic:

- **`clients`** Map — WebSocket connections from Chrome extensions, keyed by IP
- **`sseSessions`** Map — SSE transports from AI clients, keyed by session ID
- **`pairings`** Map — Links SSE sessions to extension WebSockets by matching IP
- **`pendingRequests`** Map — Tracks in-flight tool calls awaiting extension responses

Flow: AI sends tool call via SSE → server looks up paired extension by IP → forwards request over WebSocket → extension executes on-chain → response returns through the same path.

### Timeouts and Heartbeat

- 60-second timeout on extension responses to tool calls
- 15-second heartbeat ping to keep WebSocket connections alive

## Tools (27 total)

**2 server-side** (handled directly by the server):
- `wallet_listInstances` — Lists connected extensions
- `wallet_selectInstance` — Selects which extension to pair with

**25 forwarded to extension** (relayed over WebSocket):
- Account: listAccounts, selectAccount, createAccount, importAccount, deleteAccount
- EVM: getAddress, getBalance, getTokenBalance, sendTransaction, sendToken, approveToken
- Solana: solana_getAddress, solana_getBalance, solana_getAirdrop, solana_sendTransaction, solana_signMessage
- Blockchain: getNetwork, switchNetwork, getBlockNumber, getGasPrice
- Advanced: callContract, estimateGas, signMessage, getTransactionHistory, getStatus

## Testing

- E2E tests in `src/__tests__/e2e/`
- `mock-extension.ts` — Simulates the Chrome extension over WebSocket
- `setup.ts` — Starts a local server instance for tests
- `helpers.ts` — Shared test utilities
- Test files: account-tools, read-tools, evm-write-tools, solana-tools, error-cases
