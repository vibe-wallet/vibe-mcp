# Vibe Wallet MCP Server

The protocol layer of the Vibe Stack. This server bridges AI agents (Claude, OpenCode) with the Vibe Wallet browser extension using Model Context Protocol (MCP).

## 🛡️ Zero-Config Isolation

This server implements **Smart IP Pairing**. It automatically identifies and pairs AI clients with browser extensions based on their public IP address. This ensures a private, isolated session for every user without requiring manual keys or registration.

## 🚀 Architecture

```
AI Agent (Claude/OpenCode) ──SSE──▶ Server (IP Pairing) ──WebSocket──▶ Extension ──RPC──▶ Blockchain
```

## 🔄 How It Works

1. **Extension connects** via WebSocket and sends its identity to the server
2. **AI client connects** via SSE (Server-Sent Events)
3. **Server pairs them** automatically by matching public IP addresses
4. **Tool calls flow**: AI → SSE → Server → WebSocket → Extension → Blockchain

## ⚙️ Requirements

- Node.js >= 18.0.0

## 🧱 Tech Stack

- **Express** — HTTP server and SSE transport
- **WebSocket (ws)** — Real-time communication with the Chrome extension
- **@modelcontextprotocol/sdk** — MCP protocol implementation
- **TypeScript** — Type-safe codebase

## 💻 Local Development

```bash
# Install dependencies
pnpm install

# Start dev server with hot reload
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

## 🧪 Testing

```bash
# Run all 44 E2E tests
pnpm test

# Watch mode
pnpm test:watch
```

Tests use a **mock extension client** that simulates the Chrome extension via WebSocket. All **27 tools** are covered end-to-end. Framework: **Vitest**.

## 🌐 Cloud Deployment

The server is optimized for **Fly.io** but can run on any Docker-compatible platform.

```bash
# Deploy to Fly.io
cd mcp-wallet/server
fly deploy
```

## 🛠️ AI Configuration

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibe-wallet": {
      "url": "https://vibe-wallet-mcp.fly.dev/sse"
    }
  }
}
```

### Claude Code (via mcp-remote)

Use `mcp-remote` as a stdio bridge:

```json
{
  "mcpServers": {
    "vibe-wallet": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://vibe-wallet-mcp.fly.dev/sse"]
    }
  }
}
```

## 📦 Available Tools (27)

### Connectivity (3)
- `wallet_listInstances` — List all connected Vibe Wallet instances on your local network
- `wallet_selectInstance` — Select which local wallet instance to use
- `wallet_getStatus` — Check wallet connection status

### Account Management (5)
- `wallet_listAccounts` — List all accounts in the active wallet instance
- `wallet_selectAccount` — Select which account to use
- `wallet_createAccount` — Create a new wallet account
- `wallet_importAccount` — Import a wallet account from private key
- `wallet_deleteAccount` — Delete a wallet account

### EVM Assets (6)
- `wallet_getAddress` — Get current active wallet address
- `wallet_getBalance` — Get current ETH balance
- `wallet_getTokenBalance` — Get ERC-20 token balance
- `wallet_sendTransaction` — Send ETH (requires approval/YOLO)
- `wallet_sendToken` — Send ERC-20 tokens
- `wallet_approveToken` — Approve token spender

### Solana (5)
- `solana_getAddress` — Get Solana address
- `solana_getBalance` — Get Solana balance
- `solana_getAirdrop` — Get Solana devnet airdrop
- `solana_sendTransaction` — Send Solana transaction
- `solana_signMessage` — Sign Solana message

### Blockchain Info (4)
- `wallet_getNetwork` — Get current network name
- `wallet_switchNetwork` — Switch between supported networks
- `wallet_getBlockNumber` — Get current block number
- `wallet_getGasPrice` — Get current gas price

### Advanced (4)
- `wallet_callContract` — Read-only contract call
- `wallet_estimateGas` — Estimate gas for a transaction
- `wallet_signMessage` — Sign a message (requires approval/YOLO)
- `wallet_getTransactionHistory` — Get recent transaction history

## 📜 License

MIT
