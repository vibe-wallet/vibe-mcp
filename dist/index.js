import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
// =============================================================================
// CONFIGURATION
// =============================================================================
const PORT = parseInt(process.env.PORT || "3000");
const HOST = process.env.HOST || "0.0.0.0";
// =============================================================================
// EXPRESS APP SETUP
// =============================================================================
const app = express();
app.use(cors());
app.use(express.json());
const httpServer = createServer(app);
// =============================================================================
// WEBSOCKET SERVER FOR BROWSER EXTENSIONS
// =============================================================================
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const clients = new Map();
let activeClientId = null;
const pendingRequests = new Map();
console.log(`[VIBE] Starting Vibe Wallet MCP Server...`);
wss.on("connection", (ws) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log(`[VIBE] Extension connected (ID: ${clientId})`);
    const client = {
        id: clientId,
        socket: ws,
        alive: true
    };
    clients.set(clientId, client);
    if (!activeClientId) {
        activeClientId = clientId;
        console.log(`[VIBE] Set active client: ${clientId}`);
    }
    ws.on("pong", () => {
        client.alive = true;
    });
    ws.on("message", (message) => {
        client.alive = true;
        try {
            const data = JSON.parse(message.toString());
            if (data.type === "identity") {
                client.identity = data.identity;
                console.log(`[VIBE] Identity: ${data.identity.browser} (${data.identity.activeAccount})`);
                return;
            }
            if (data.type === "heartbeat") {
                return;
            }
            if (data.id && pendingRequests.has(data.id)) {
                const { resolve, reject, timeout } = pendingRequests.get(data.id);
                clearTimeout(timeout);
                if (data.error) {
                    reject(new Error(data.error.message));
                }
                else {
                    resolve(data.result);
                }
                pendingRequests.delete(data.id);
            }
        }
        catch (e) {
            console.error("[VIBE] Failed to parse message:", e);
        }
    });
    ws.on("close", (code) => {
        console.log(`[VIBE] Extension disconnected (ID: ${clientId}, code: ${code})`);
        clients.delete(clientId);
        if (activeClientId === clientId) {
            activeClientId = clients.keys().next().value || null;
            if (activeClientId) {
                console.log(`[VIBE] New active client: ${activeClientId}`);
            }
        }
    });
    ws.on("error", (err) => {
        console.error(`[VIBE] WebSocket error (ID: ${clientId}):`, err.message);
        clients.delete(clientId);
    });
});
// Heartbeat interval
setInterval(() => {
    clients.forEach((client, id) => {
        if (!client.alive) {
            console.log(`[VIBE] Client ${id} dead, terminating...`);
            client.socket.terminate();
            clients.delete(id);
            return;
        }
        client.alive = false;
        if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.ping();
        }
    });
}, 15000);
// =============================================================================
// EXTENSION COMMUNICATION
// =============================================================================
function sendToExtension(method, params) {
    return new Promise((resolve, reject) => {
        const client = activeClientId ? clients.get(activeClientId) : null;
        if (!client || client.socket.readyState !== WebSocket.OPEN) {
            reject(new Error("No Vibe Wallet extension connected. Please open the extension and ensure it's connected to this server."));
            return;
        }
        const id = Math.random().toString(36).substring(7);
        const timeout = setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                reject(new Error("Request timed out. The extension did not respond."));
            }
        }, 60000);
        pendingRequests.set(id, { resolve, reject, timeout });
        client.socket.send(JSON.stringify({ id, method, params }));
    });
}
// =============================================================================
// MCP SERVER SETUP
// =============================================================================
function createMCPServer() {
    const server = new Server({
        name: "vibe-wallet",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    // Tool definitions
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "wallet_listInstances",
                    description: "List all connected Vibe Wallet instances (different browsers/profiles)",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_selectInstance",
                    description: "Select which wallet instance to use",
                    inputSchema: {
                        type: "object",
                        properties: {
                            instanceId: { type: "string", description: "The ID of the instance to select" },
                        },
                        required: ["instanceId"],
                    },
                },
                {
                    name: "wallet_listAccounts",
                    description: "List all accounts in the active wallet instance",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_selectAccount",
                    description: "Select which account to use in the active instance",
                    inputSchema: {
                        type: "object",
                        properties: {
                            accountName: { type: "string", description: "The name of the account to select" },
                        },
                        required: ["accountName"],
                    },
                },
                {
                    name: "wallet_createAccount",
                    description: "Create a new wallet account with a friendly name",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "A friendly name for this account (e.g., 'Main', 'Bot')" },
                        },
                        required: ["name"],
                    },
                },
                {
                    name: "wallet_importAccount",
                    description: "Import a wallet account using a private key",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "A friendly name for this account (e.g., 'Main', 'Bot')" },
                            privateKey: { type: "string", description: "The private key (0x...)" },
                        },
                        required: ["name", "privateKey"],
                    },
                },
                {
                    name: "wallet_getAddress",
                    description: "Get the wallet address",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_getBalance",
                    description: "Get the wallet balance in ETH",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_getNetwork",
                    description: "Get the current network name",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_sendTransaction",
                    description: "Send a transaction (will require user approval in wallet)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            to: { type: "string", description: "Recipient address (0x...)" },
                            value: { type: "string", description: "Value in wei (string)" },
                            data: { type: "string", description: "Hex data for contract calls (optional)" },
                        },
                        required: ["to"],
                    },
                },
                {
                    name: "wallet_switchNetwork",
                    description: "Switch the current network",
                    inputSchema: {
                        type: "object",
                        properties: {
                            chain: { type: "string", description: "Chain key: 'sepolia', 'base-sepolia', 'arbitrum-sepolia', 'mantle-sepolia'" },
                        },
                        required: ["chain"],
                    },
                },
                {
                    name: "wallet_signMessage",
                    description: "Sign a message with the wallet (will require user approval)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            message: { type: "string", description: "Message to sign" },
                        },
                        required: ["message"],
                    },
                },
                {
                    name: "wallet_getConnectedSites",
                    description: "Get list of sites connected to the wallet",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_disconnectSite",
                    description: "Disconnect a specific site from the wallet",
                    inputSchema: {
                        type: "object",
                        properties: {
                            origin: { type: "string", description: "Site origin to disconnect (e.g., 'https://app.uniswap.org')" },
                        },
                        required: ["origin"],
                    },
                },
                {
                    name: "wallet_disconnectAll",
                    description: "Disconnect all sites from the wallet",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_addToken",
                    description: "Add a custom token to the wallet",
                    inputSchema: {
                        type: "object",
                        properties: {
                            address: { type: "string", description: "Token contract address" },
                            symbol: { type: "string", description: "Token symbol" },
                            decimals: { type: "number", description: "Token decimals (usually 18)" },
                        },
                        required: ["address", "symbol", "decimals"],
                    },
                },
                {
                    name: "wallet_getTokens",
                    description: "Get all custom tokens added to the wallet",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_removeToken",
                    description: "Remove a token from the wallet",
                    inputSchema: {
                        type: "object",
                        properties: {
                            address: { type: "string", description: "Token contract address to remove" },
                        },
                        required: ["address"],
                    },
                },
                {
                    name: "wallet_getStatus",
                    description: "Get the wallet connection status and current state",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_getTransactionReceipt",
                    description: "Get the receipt of a transaction by hash (to verify if it succeeded)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            hash: { type: "string", description: "Transaction hash (0x...)" },
                        },
                        required: ["hash"],
                    },
                },
                {
                    name: "wallet_callContract",
                    description: "Call a read-only contract method (no gas needed)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            to: { type: "string", description: "Contract address (0x...)" },
                            data: { type: "string", description: "Encoded function call data (0x...)" },
                        },
                        required: ["to", "data"],
                    },
                },
                {
                    name: "wallet_estimateGas",
                    description: "Estimate gas for a transaction",
                    inputSchema: {
                        type: "object",
                        properties: {
                            to: { type: "string", description: "Recipient address (0x...)" },
                            value: { type: "string", description: "Value in wei (optional)" },
                            data: { type: "string", description: "Hex data (optional)" },
                        },
                        required: ["to"],
                    },
                },
                {
                    name: "debug_getPrivateKey",
                    description: "Get the private key (WARNING: FOR DEV/TESTING ONLY - NEVER USE ON MAINNET)",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_getTokenBalance",
                    description: "Get the balance of an ERC-20 token for the wallet",
                    inputSchema: {
                        type: "object",
                        properties: {
                            tokenAddress: { type: "string", description: "Token contract address (0x...)" },
                            decimals: { type: "number", description: "Token decimals (optional, defaults to 18)" },
                        },
                        required: ["tokenAddress"],
                    },
                },
                {
                    name: "wallet_sendToken",
                    description: "Send ERC-20 tokens to an address",
                    inputSchema: {
                        type: "object",
                        properties: {
                            tokenAddress: { type: "string", description: "Token contract address (0x...)" },
                            to: { type: "string", description: "Recipient address (0x...)" },
                            amount: { type: "string", description: "Amount to send (human readable, e.g. '10.5')" },
                            decimals: { type: "number", description: "Token decimals (optional, defaults to 18)" },
                        },
                        required: ["tokenAddress", "to", "amount"],
                    },
                },
                {
                    name: "wallet_getTransactionHistory",
                    description: "Get recent transaction history for the wallet (requires Etherscan/block explorer API)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            limit: { type: "number", description: "Number of transactions to return (default 10)" },
                        },
                    },
                },
                {
                    name: "wallet_approveToken",
                    description: "Approve a spender to spend ERC-20 tokens on your behalf",
                    inputSchema: {
                        type: "object",
                        properties: {
                            tokenAddress: { type: "string", description: "Token contract address (0x...)" },
                            spender: { type: "string", description: "Spender contract address (0x...)" },
                            amount: { type: "string", description: "Amount to approve (human readable, or 'unlimited')" },
                            decimals: { type: "number", description: "Token decimals (optional, defaults to 18)" },
                        },
                        required: ["tokenAddress", "spender", "amount"],
                    },
                },
                {
                    name: "wallet_getTokenAllowance",
                    description: "Check how much of a token a spender is allowed to use",
                    inputSchema: {
                        type: "object",
                        properties: {
                            tokenAddress: { type: "string", description: "Token contract address (0x...)" },
                            spender: { type: "string", description: "Spender address (0x...)" },
                            decimals: { type: "number", description: "Token decimals (optional, defaults to 18)" },
                        },
                        required: ["tokenAddress", "spender"],
                    },
                },
                {
                    name: "wallet_getBlockNumber",
                    description: "Get the current block number on the active chain",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_getGasPrice",
                    description: "Get the current gas price on the active chain",
                    inputSchema: { type: "object", properties: {} },
                },
            ],
        };
    });
    // Tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            // Server-side tools
            if (name === "wallet_listInstances") {
                const list = Array.from(clients.values()).map(c => ({
                    id: c.id,
                    browser: c.identity?.browser || "Unknown",
                    activeAccount: c.identity?.activeAccount || "None",
                    activeChain: c.identity?.activeChain || "Unknown",
                    isActive: c.id === activeClientId
                }));
                return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
            }
            if (name === "wallet_selectInstance") {
                const { instanceId } = args;
                if (clients.has(instanceId)) {
                    activeClientId = instanceId;
                    return { content: [{ type: "text", text: `Instance ${instanceId} selected.` }] };
                }
                return { content: [{ type: "text", text: `Error: Instance ${instanceId} not found.` }], isError: true };
            }
            // Forward to extension
            const result = await sendToExtension(name, args);
            return {
                content: [
                    {
                        type: "text",
                        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
                isError: true,
            };
        }
    });
    return server;
}
// =============================================================================
// SSE TRANSPORT MANAGEMENT
// =============================================================================
const transports = new Map();
// SSE endpoint for MCP clients
app.get("/sse", async (req, res) => {
    console.log("[VIBE] New MCP client connected via SSE");
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);
    const server = createMCPServer();
    res.on("close", () => {
        console.log(`[VIBE] MCP client disconnected (session: ${sessionId})`);
        transports.delete(sessionId);
    });
    await server.connect(transport);
});
// Messages endpoint for MCP commands
app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports.get(sessionId);
    if (!transport) {
        res.status(404).json({ error: "Session not found" });
        return;
    }
    await transport.handlePostMessage(req, res);
});
// =============================================================================
// HEALTH & STATUS ENDPOINTS
// =============================================================================
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        version: "1.0.0",
        connectedExtensions: clients.size,
        activeClient: activeClientId
    });
});
app.get("/status", (_req, res) => {
    const extensions = Array.from(clients.values()).map(c => ({
        id: c.id,
        browser: c.identity?.browser || "Unknown",
        account: c.identity?.activeAccount || "None",
        chain: c.identity?.activeChain || "Unknown",
        isActive: c.id === activeClientId
    }));
    res.json({
        server: "vibe-wallet-mcp",
        version: "1.0.0",
        mcpClients: transports.size,
        extensions,
    });
});
// =============================================================================
// LANDING PAGE
// =============================================================================
app.get("/", (_req, res) => {
    const baseUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibe Wallet MCP Server</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0b;
            color: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { max-width: 600px; padding: 40px; text-align: center; }
        .logo { font-size: 48px; margin-bottom: 20px; }
        h1 { font-size: 32px; font-weight: 900; font-style: italic; margin-bottom: 8px; }
        .subtitle { color: #8b5cf6; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 40px; }
        .status { 
            background: rgba(34, 197, 94, 0.1); 
            border: 1px solid rgba(34, 197, 94, 0.3);
            padding: 16px 24px;
            border-radius: 12px;
            margin-bottom: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .status-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .section { text-align: left; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 24px; margin-bottom: 20px; }
        .section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 16px; }
        pre { 
            background: #111; 
            padding: 16px; 
            border-radius: 8px; 
            overflow-x: auto; 
            font-size: 13px;
            line-height: 1.6;
        }
        code { color: #8b5cf6; }
        .copy-btn {
            background: #8b5cf6;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 12px;
        }
        .copy-btn:hover { background: #7c3aed; }
        a { color: #8b5cf6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">⚡</div>
        <h1>VIBE WALLET</h1>
        <p class="subtitle">MCP Server</p>
        
        <div class="status">
            <div class="status-dot"></div>
            <span>Server Online</span>
        </div>

        <div class="section">
            <h2>Add to Claude Desktop</h2>
            <pre><code>{
  "mcpServers": {
    "vibe-wallet": {
      "url": "${baseUrl}/sse"
    }
  }
}</code></pre>
            <button class="copy-btn" onclick="navigator.clipboard.writeText(JSON.stringify({mcpServers:{'vibe-wallet':{url:'${baseUrl}/sse'}}}, null, 2))">Copy Config</button>
        </div>

        <div class="section">
            <h2>Extension WebSocket URL</h2>
            <pre><code>${baseUrl.replace('http', 'ws')}/ws</code></pre>
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 40px;">
            <a href="/status">View Status</a> · <a href="/health">Health Check</a>
        </p>
    </div>
</body>
</html>
    `);
});
// =============================================================================
// START SERVER
// =============================================================================
httpServer.listen(PORT, HOST, () => {
    console.log(`[VIBE] ✓ Server running on http://${HOST}:${PORT}`);
    console.log(`[VIBE] ✓ MCP SSE endpoint: /sse`);
    console.log(`[VIBE] ✓ Extension WebSocket: /ws`);
    console.log(`[VIBE] ✓ Health check: /health`);
});
//# sourceMappingURL=index.js.map