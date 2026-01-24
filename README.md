# Vibe Wallet MCP Server

MCP server that enables AI agents to control the Vibe Wallet browser extension.

## Architecture

```
AI Agent (Claude/OpenCode) ──MCP──▶ Server ──WebSocket──▶ Extension ──RPC──▶ Blockchain
```

## Setup

```bash
cd mcp-wallet/server
npm install
```

### OpenCode Configuration

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "vibe-wallet": {
      "type": "local",
      "command": ["npx", "-y", "tsx", "/absolute/path/to/mcp-wallet/server/src/index.ts"],
      "enabled": true
    }
  }
}
```

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibe-wallet": {
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/mcp-wallet/server/src/index.ts"]
    }
  }
}
```

## Available Tools

### Wallet State
| Tool | Description |
|------|-------------|
| `wallet_getAddress` | Get wallet address |
| `wallet_getBalance` | Get balance (wei) |
| `wallet_getNetwork` | Get current network |
| `wallet_getStatus` | Get full status |

### Transactions
| Tool | Parameters | Description |
|------|------------|-------------|
| `wallet_sendTransaction` | `to`, `value?`, `data?` | Send transaction |
| `wallet_signMessage` | `message` | Sign message |
| `wallet_getTransactionReceipt` | `hash` | Get receipt |
| `wallet_estimateGas` | `to`, `value?`, `data?` | Estimate gas |
| `wallet_callContract` | `to`, `data` | Read-only call |

### Network & Tokens
| Tool | Parameters | Description |
|------|------------|-------------|
| `wallet_switchNetwork` | `chain` | Switch network |
| `wallet_addToken` | `address`, `symbol`, `decimals` | Add token |
| `wallet_getTokens` | — | List tokens |
| `wallet_removeToken` | `address` | Remove token |

### Site Management
| Tool | Parameters | Description |
|------|------------|-------------|
| `wallet_getConnectedSites` | — | List connected DApps |
| `wallet_disconnectSite` | `origin` | Disconnect site |
| `wallet_disconnectAll` | — | Disconnect all |

### Multi-Instance & Account Management
| Tool | Parameters | Description |
|------|------------|-------------|
| `wallet_listInstances` | — | List all connected extension instances (browsers) |
| `wallet_selectInstance` | `instanceId` | Select which browser instance to control |
| `wallet_listAccounts` | — | List all accounts in active instance |
| `wallet_selectAccount` | `accountName` | Switch between accounts (e.g. 'Main', 'Bot') |
| `wallet_createAccount` | `name` | Generate a new named account |
| `wallet_importAccount` | `name`, `privateKey` | Import a private key with a name |

### Advanced Token Operations
| Tool | Parameters | Description |
|------|------------|-------------|
| `wallet_getTokenBalance` | `tokenAddress`, `decimals?` | Get ERC-20 balance |
| `wallet_sendToken` | `tokenAddress`, `to`, `amount`, `decimals?` | Transfer ERC-20 tokens |
| `wallet_approveToken` | `tokenAddress`, `spender`, `amount`, `decimals?` | Approve token spending |
| `wallet_getTokenAllowance` | `tokenAddress`, `spender`, `decimals?` | Check current allowance |

### Blockchain Data
| Tool | Parameters | Description |
|------|------------|-------------|
| `wallet_getBlockNumber` | — | Get current block height |
| `wallet_getGasPrice` | — | Get current network gas price |
| `wallet_getTransactionHistory`| `limit?` | Get recent transactions (placeholder) |

### Debug
| Tool | Description |
|------|-------------|
| `debug_getPrivateKey` | Export private key (dev only) |

## Dashboard

The project now includes a real-time web dashboard to visualize your wallet state across all instances.

### Dashboard Features:
- **Multi-Instance View:** Monitor all connected browser extensions.
- **Account Management:** View and switch between multiple named accounts.
- **Token Portfolio:** Real-time balances for native assets and custom ERC-20 tokens.
- **Transaction Monitoring:** View recent activity and connection status.
- **MCP Integration:** Direct visibility into the MCP server connection status.

## Usage Examples

```
"List all browser instances"      → wallet_listInstances
"Switch to my 'Bot' account"      → wallet_selectAccount(accountName: "Bot")
"Check my USDC balance"           → wallet_getTokenBalance(tokenAddress: "0x...")
"Transfer 10 tokens to 0x..."      → wallet_sendToken(tokenAddress: "0x...", to: "0x...", amount: "10")
"Get my wallet address"           → wallet_getAddress
"Send 0.01 ETH to 0x..."          → wallet_sendTransaction  
"Switch to Sepolia"               → wallet_switchNetwork
"Sign message 'Hello'"            → wallet_signMessage
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not connected | Open Chrome and click Vibe Wallet icon |
| Multiple instances connected | Use `wallet_listInstances` to see which is active |
| Port 8080 in use | `lsof -ti :8080 | xargs kill -9` |
| Request timeout | Reload extension, ensure wallet is initialized |
| Identity mismatch | Refresh the Dashboard or use `wallet_selectInstance` |

## Requirements

- Node.js 18+
- Vibe Wallet extension installed and open
- Wallet initialized (first-time setup complete)

## License

MIT
