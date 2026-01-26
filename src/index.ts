import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

const PORT = 3000;
const app = express();
app.use(cors());
const httpServer = createServer(app);

// State
const clients = new Map<string, any>();
const sseSessions = new Map<string, any>();
const pairings = new Map<string, string>();
const pendingRequests = new Map<string, any>();

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws, req) => {
    const id = Math.random().toString(36).substring(7);
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    const client: any = { id, socket: ws, ip, alive: true };
    clients.set(id, client);
    console.log(`[VIBE] Ext connected: ${id} (IP: ${ip})`);
    
    ws.on("pong", () => { client.alive = true; });
    ws.on("message", (msg) => {
        client.alive = true;
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === "identity") {
                console.log(`[VIBE] Ext ${id} identity: ${data.identity?.name || 'Unnamed'}`);
                client.identity = data.identity;
                for (const [sseId, session] of sseSessions.entries()) {
                    if (session.ip === ip) {
                        console.log(`[VIBE] Pairing SSE ${sseId} with Ext ${id}`);
                        pairings.set(sseId, id);
                    }
                }
            } else if (data.id && pendingRequests.has(data.id)) {
                const { resolve, reject, timeout } = pendingRequests.get(data.id);
                clearTimeout(timeout);
                if (data.error) reject(new Error(data.error.message));
                else resolve(data.result);
                pendingRequests.delete(data.id);
            }
        } catch (e) { console.error("[VIBE] Message error:", e); }
    });
    ws.on("close", () => {
        console.log(`[VIBE] Ext ${id} disconnected`);
        clients.delete(id);
        for (const [sid, eid] of pairings.entries()) if (eid === id) pairings.delete(sid);
    });
});

setInterval(() => {
    clients.forEach(c => {
        if (!c.alive) { 
            console.log(`[VIBE] Terminating stale ext: ${c.id}`);
            c.socket.terminate(); 
            clients.delete(c.id); 
            return; 
        }
        c.alive = false; c.socket.ping();
    });
}, 15000);

function createMCPServer(sseSessionId: string) {
    const server = new Server({ name: "vibe-wallet", version: "1.2.1" }, { capabilities: { tools: {} } });
    
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            { name: "wallet_listInstances", description: "List all connected Vibe Wallet instances on your local network", inputSchema: { type: "object" } },
            { name: "wallet_selectInstance", description: "Select which local wallet instance to use", inputSchema: { type: "object", properties: { instanceId: { type: "string" } }, required: ["instanceId"] } },
            { name: "wallet_getAddress", description: "Get current active wallet address", inputSchema: { type: "object" } },
            { name: "wallet_getBalance", description: "Get current ETH balance", inputSchema: { type: "object" } },
            { name: "wallet_getNetwork", description: "Get current network name", inputSchema: { type: "object" } },
            { name: "wallet_switchNetwork", description: "Switch between supported networks", inputSchema: { type: "object", properties: { chain: { type: "string", description: "Chain key (e.g. 'base-sepolia', 'sepolia', 'arbitrum-sepolia')" } }, required: ["chain"] } },
            { name: "wallet_sendTransaction", description: "Send ETH (requires approval/YOLO)", inputSchema: { type: "object", properties: { to: { type: "string" }, value: { type: "string" }, data: { type: "string" } }, required: ["to"] } },
            { name: "wallet_signMessage", description: "Sign a message (requires approval/YOLO)", inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } },
            { name: "wallet_listAccounts", description: "List all accounts in the active wallet instance", inputSchema: { type: "object" } },
            { name: "wallet_selectAccount", description: "Select which account to use", inputSchema: { type: "object", properties: { accountName: { type: "string" } }, required: ["accountName"] } },
            { name: "wallet_createAccount", description: "Create a new wallet account", inputSchema: { type: "object", properties: { name: { type: "string" }, type: { type: "string", enum: ["evm", "solana"], description: "Default is 'evm'" } }, required: ["name"] } },
            { name: "wallet_importAccount", description: "Import a wallet account from private key", inputSchema: { type: "object", properties: { name: { type: "string" }, privateKey: { type: "string" }, type: { type: "string", enum: ["evm", "solana"], description: "Default is 'evm'" } }, required: ["name", "privateKey"] } },
            { name: "wallet_deleteAccount", description: "Delete a wallet account", inputSchema: { type: "object", properties: { accountName: { type: "string" } }, required: ["accountName"] } },
            { name: "solana_getAddress", description: "Get Solana address", inputSchema: { type: "object" } },
            { name: "solana_getBalance", description: "Get Solana balance", inputSchema: { type: "object" } },
            { name: "solana_getAirdrop", description: "Get Solana devnet airdrop", inputSchema: { type: "object" } },
            { name: "solana_sendTransaction", description: "Send Solana transaction", inputSchema: { type: "object", properties: { to: { type: "string" }, value: { type: "string", description: "Amount in lamports" } }, required: ["to", "value"] } },
            { name: "solana_signMessage", description: "Sign Solana message", inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } },
            { name: "wallet_getTokenBalance", description: "Get ERC-20 token balance", inputSchema: { type: "object", properties: { tokenAddress: { type: "string" }, decimals: { type: "number" } }, required: ["tokenAddress"] } },
            { name: "wallet_sendToken", description: "Send ERC-20 tokens", inputSchema: { type: "object", properties: { tokenAddress: { type: "string" }, to: { type: "string" }, amount: { type: "string" }, decimals: { type: "number" } }, required: ["tokenAddress", "to", "amount"] } },
            { name: "wallet_approveToken", description: "Approve token spender", inputSchema: { type: "object", properties: { tokenAddress: { type: "string" }, spender: { type: "string" }, amount: { type: "string" }, decimals: { type: "number" } }, required: ["tokenAddress", "spender", "amount"] } },
            { name: "wallet_callContract", description: "Read-only contract call", inputSchema: { type: "object", properties: { to: { type: "string" }, data: { type: "string" } }, required: ["to", "data"] } },
            { name: "wallet_estimateGas", description: "Estimate gas for a transaction", inputSchema: { type: "object", properties: { to: { type: "string" }, value: { type: "string" }, data: { type: "string" } }, required: ["to"] } },
            { name: "wallet_getBlockNumber", description: "Get current block number", inputSchema: { type: "object" } },
            { name: "wallet_getGasPrice", description: "Get current gas price", inputSchema: { type: "object" } },
            { name: "wallet_getTransactionHistory", description: "Get recent transaction history", inputSchema: { type: "object" } },
            { name: "wallet_getStatus", description: "Check wallet connection status", inputSchema: { type: "object" } },
        ]
    }));

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args } = req.params;
        const session = sseSessions.get(sseSessionId);
        if (!session) throw new Error("Session lost");

        if (name === "wallet_listInstances") {
            const list = Array.from(clients.values())
                .filter(c => c.ip === session.ip)
                .map(c => ({ id: c.id, name: c.identity?.name || "Unnamed", activeAccount: c.identity?.activeAccount || "None", isActive: c.id === pairings.get(sseSessionId) }));
            return { content: [{ type: "text", text: JSON.stringify(list) }] };
        }

        if (name === "wallet_selectInstance") {
            const { instanceId } = args as { instanceId: string };
            if (clients.has(instanceId) && clients.get(instanceId)?.ip === session.ip) {
                pairings.set(sseSessionId, instanceId);
                return { content: [{ type: "text", text: `Instance ${instanceId} selected.` }] };
            }
            return { content: [{ type: "text", text: "Error: Instance not found on your network." }], isError: true };
        }

        const eid = pairings.get(sseSessionId);
        const client = eid ? clients.get(eid) : null;
        if (!client) throw new Error("No paired wallet found on this machine. Ensure your browser extension is open.");

        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).substring(7);
            const timeout = setTimeout(() => { 
                pendingRequests.delete(id); 
                reject(new Error("Extension timed out.")); 
            }, 60000);

            pendingRequests.set(id, { 
                resolve: (r: any) => resolve({ content: [{ type: "text", text: typeof r === 'string' ? r : JSON.stringify(r) }] }), 
                reject: (e: any) => reject(e), 
                timeout 
            });
            client.socket.send(JSON.stringify({ id, method: name, params: args }));
        });
    });
    return server;
}

function sendToExtension(sseSessionId: string, method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const extId = pairings.get(sseSessionId);
        const client = extId ? clients.get(extId) : null;
        if (!client || client.socket.readyState !== WebSocket.OPEN) return reject(new Error("No wallet"));

        const id = Math.random().toString(36).substring(7);
        const timeout = setTimeout(() => { pendingRequests.delete(id); reject(new Error("Timeout")); }, 60000);

        pendingRequests.set(id, { resolve, reject, timeout });
        client.socket.send(JSON.stringify({ id, method, params }));
    });
}

app.get("/health", (req, res) => res.json({ status: "ok", clients: clients.size, pairings: pairings.size }));

app.get("/sse", async (req: any, res: any) => {
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    console.log(`[VIBE] AI Client connected (IP: ${ip})`);
    
    const transport = new SSEServerTransport("/sse", res);
    const sid = transport.sessionId;
    sseSessions.set(sid, { sse: transport, ip });
    
    const local = Array.from(clients.values()).find(c => c.ip === ip);
    if (local) pairings.set(sid, local.id);

    const server = createMCPServer(sid);
    res.on("close", () => { sseSessions.delete(sid); pairings.delete(sid); });
    await server.connect(transport);
});

app.post("/sse", (req: any, res: any) => {
    const s = sseSessions.get(req.query.sessionId as string);
    if (s) s.sse.handlePostMessage(req, res);
    else res.status(404).end();
});

app.get("/", (req, res) => res.send("Vibe Wallet MCP Live. Configure Claude with /sse"));

httpServer.listen(PORT, "0.0.0.0", () => console.log(`[VIBE] Server live on ${PORT}`));
