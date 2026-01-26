# Vibe Wallet MCP Server

The protocol layer of the Vibe Stack. This server bridges AI agents (Claude, OpenCode) with the Vibe Wallet browser extension using Model Context Protocol (MCP).

## 🛡️ Zero-Config Isolation

This server implements **Smart IP Pairing**. It automatically identifies and pairs AI clients with browser extensions based on their public IP address. This ensures a private, isolated session for every user without requiring manual keys or registration.

## 🚀 Architecture

```
AI Agent (Claude/OpenCode) ──SSE──▶ Server (IP Pairing) ──WebSocket──▶ Extension ──RPC──▶ Blockchain
```

## 🌐 Cloud Deployment

The server is optimized for **Fly.io** but can run on any Docker-compatible platform.

```bash
# Deploy to Fly.io
cd mcp-wallet/server
fly deploy
```

## 🛠️ AI Configuration

Add this to your `claude_desktop_config.json` or OpenCode settings:

```json
{
  "mcpServers": {
    "vibe-wallet": {
      "url": "https://vibe-wallet-mcp.fly.dev/sse"
    }
  }
}
```

## 📦 Available Tools

- **Connectivity**: `wallet_listInstances`, `wallet_selectInstance`, `wallet_getStatus`
- **Account**: `wallet_listAccounts`, `wallet_selectAccount`, `wallet_createAccount`, `wallet_importAccount`, `wallet_deleteAccount`
- **Assets**: `wallet_getAddress`, `wallet_getBalance`, `wallet_getTokenBalance`, `wallet_sendTransaction`, `wallet_sendToken`, `wallet_approveToken`
- **Solana**: `solana_getBalance`, `solana_sendTransaction`, `solana_getAirdrop`, `solana_getAddress`, `solana_signMessage`
- **Blockchain**: `wallet_getNetwork`, `wallet_switchNetwork`, `wallet_getBlockNumber`, `wallet_getGasPrice`
- **Advanced**: `wallet_callContract`, `wallet_estimateGas`, `wallet_signMessage`

## 📜 License

MIT
