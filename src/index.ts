import express, { Request, Response } from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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
const httpServer = createServer(app);

// =============================================================================
// TYPES
// =============================================================================
interface ExtensionClient {
    id: string;
    socket: WebSocket;
    ip: string;
    identity?: {
        name: string;
        browser: string;
        activeAccount: string;
        address: string;
    };
    alive: boolean;
}

interface SSESession {
    sse: SSEServerTransport;
    ip: string;
    pairedExtensionId?: string;
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================
const clients = new Map<string, ExtensionClient>();
const sseSessions = new Map<string, SSESession>();
const pairings = new Map<string, string>(); // sseSessionId -> extensionId

const pendingRequests = new Map<string, { 
    resolve: (value: any) => void; 
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
}>();

// =============================================================================
// WEBSOCKET SERVER (BROWSER EXTENSIONS)
// =============================================================================
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    
    console.log(`[VIBE] Extension connected (IP: ${ip}, ID: ${clientId})`);
    
    const client: ExtensionClient = {
        id: clientId,
        socket: ws,
        ip,
        alive: true
    };
    clients.set(clientId, client);
    
    ws.on("pong", () => { client.alive = true; });

    ws.on("message", (message) => {
        client.alive = true;
        try {
            const data = JSON.parse(message.toString());
            
            if (data.type === "identity") {
                client.identity = data.identity;
                console.log(`[VIBE] [${ip}] Device Identity: ${data.identity.name || data.identity.browser}`);
                
                // Auto-pair with any unpaired SSE session on the same IP
                for (const [sseId, session] of sseSessions.entries()) {
                    if (session.ip === ip && !session.pairedExtensionId) {
                        console.log(`[VIBE] Auto-pairing SSE ${sseId} with Ext ${clientId} on IP ${ip}`);
                        session.pairedExtensionId = clientId;
                        pairings.set(sseId, clientId);
                        break;
                    }
                }
                return;
            }

            if (data.type === "heartbeat") return;
            
            if (data.id && pendingRequests.has(data.id)) {
                const { resolve, reject, timeout } = pendingRequests.get(data.id)!;
                clearTimeout(timeout);
                if (data.error) reject(new Error(data.error.message));
                else resolve(data.result);
                pendingRequests.delete(data.id);
            }
        } catch (e) {
            console.error("[VIBE] Failed to parse message:", e);
        }
    });

    ws.on("close", () => {
        console.log(`[VIBE] Extension disconnected (ID: ${clientId})`);
        clients.delete(clientId);
        // Clean up pairings associated with this extension
        for (const [sseId, extId] of pairings.entries()) {
            if (extId === clientId) {
                const session = sseSessions.get(sseId);
                if (session) session.pairedExtensionId = undefined;
                pairings.delete(sseId);
            }
        }
    });
});

// Heartbeat
setInterval(() => {
    clients.forEach((client, id) => {
        if (!client.alive) {
            client.socket.terminate();
            clients.delete(id);
            return;
        }
        client.alive = false;
        if (client.socket.readyState === WebSocket.OPEN) client.socket.ping();
    });
}, 15000);

// =============================================================================
// MCP SERVER TOOLS
// =============================================================================
function createMCPServer(sseSessionId: string) {
    const server = new Server(
        { name: "vibe-wallet", version: "1.2.1" },
        { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "wallet_getStatus",
                    description: "Check if the local browser extension is connected and paired",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_listInstances",
                    description: "List all connected Vibe Wallet instances on your local network",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_selectInstance",
                    description: "Select which local wallet instance to use",
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
                    description: "Create a new wallet account",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Account name" },
                        },
                        required: ["name"],
                    },
                },
                {
                    name: "wallet_importAccount",
                    description: "Import a wallet account from private key",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Account name" },
                            privateKey: { type: "string", description: "0x..." },
                        },
                        required: ["name", "privateKey"],
                    },
                },
                {
                    name: "wallet_getAddress",
                    description: "Get the current active wallet address",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_getBalance",
                    description: "Get the current ETH balance",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_getNetwork",
                    description: "Get current network name",
                    inputSchema: { type: "object", properties: {} },
                },
                {
                    name: "wallet_sendTransaction",
                    description: "Send ETH (requires approval/YOLO)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            to: { type: "string", description: "Recipient address (0x...)" },
                            value: { type: "string", description: "Value in wei" },
                            data: { type: "string", description: "Hex data (optional)" },
                        },
                        required: ["to"],
                    },
                },
                {
                    name: "wallet_signMessage",
                    description: "Sign a message (requires approval/YOLO)",
                    inputSchema: {
                        type: "object",
                        properties: {
                            message: { type: "string", description: "Message to sign" },
                        },
                        required: ["message"],
                    },
                },
                {
                    name: "wallet_switchNetwork",
                    description: "Switch between supported networks",
                    inputSchema: {
                        type: "object",
                        properties: {
                            chain: { type: "string", description: "Chain key (e.g. 'base-sepolia')" },
                        },
                        required: ["chain"],
                    },
                },
            ],
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const session = sseSessions.get(sseSessionId);
        const ip = session?.ip;

        try {
            if (name === "wallet_getStatus") {
                const extId = pairings.get(sseSessionId);
                const client = extId ? clients.get(extId) : null;
                return { content: [{ type: "text", text: client ? "Connected and Paired" : "Disconnected" }] };
            }

            if (name === "wallet_listInstances") {
                const localClients = Array.from(clients.values()).filter(c => c.ip === ip);
                const list = localClients.map(c => ({
                    id: c.id,
                    name: c.identity?.name || "Unnamed Device",
                    activeAccount: c.identity?.activeAccount || "None",
                    isActive: c.id === pairings.get(sseSessionId)
                }));
                return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
            }

            if (name === "wallet_selectInstance") {
                const { instanceId } = args as { instanceId: string };
                if (clients.has(instanceId) && clients.get(instanceId)?.ip === ip) {
                    pairings.set(sseSessionId, instanceId);
                    return { content: [{ type: "text", text: `Instance ${instanceId} selected.` }] };
                }
                return { content: [{ type: "text", text: `Error: Wallet not found on your network.` }], isError: true };
            }

            // Forward to paired extension
            const result = await sendToExtension(sseSessionId, name, args);
            return {
                content: [
                    { type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) },
                ],
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
    });

    return server;
}

// =============================================================================
// COMMUNICATION HELPER
// =============================================================================
function sendToExtension(sseSessionId: string, method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const extId = pairings.get(sseSessionId);
        const client = extId ? clients.get(extId) : null;
        
        if (!client || client.socket.readyState !== WebSocket.OPEN) {
            reject(new Error("No Vibe Wallet paired. Ensure extension is open."));
            return;
        }

        const id = Math.random().toString(36).substring(7);
        const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error("Timeout: Extension didn't respond."));
        }, 60000);

        pendingRequests.set(id, { resolve, reject, timeout });
        client.socket.send(JSON.stringify({ id, method, params }));
    });
}

// =============================================================================
// SSE ENDPOINTS
// =============================================================================
app.get("/sse", async (req: Request, res: Response) => {
    const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    console.log(`[VIBE] New AI Client connected (IP: ${ip})`);
    
    const transport = new SSEServerTransport("/sse", res);
    const sessionId = transport.sessionId;
    
    const session: SSESession = { sse: transport, ip };
    sseSessions.set(sessionId, session);

    // Auto-pair
    const localExt = Array.from(clients.values()).find(c => c.ip === ip);
    if (localExt) {
        pairings.set(sessionId, localExt.id);
        session.pairedExtensionId = localExt.id;
    }

    const server = createMCPServer(sessionId);
    res.on("close", () => {
        sseSessions.delete(sessionId);
        pairings.delete(sessionId);
    });
    await server.connect(transport);
});

const handleMessages = async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const session = sseSessions.get(sessionId);
    if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
    }
    await session.sse.handlePostMessage(req, res);
};

app.post("/sse", handleMessages);
app.post("/messages", handleMessages);

// =============================================================================
// MISC ENDPOINTS
// =============================================================================
app.get("/health", (_req, res) => {
    res.json({ status: "ok", extensions: clients.size, pairings: pairings.size });
});

app.get("/", (req, res) => {
    const baseUrl = `https://${req.headers.host}`;
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibe Wallet MCP</title>
    <style>
        body { font-family: sans-serif; background: #0a0a0b; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
        .container { max-width: 500px; padding: 20px; }
        h1 { font-style: italic; font-weight: 900; }
        code { color: #8b5cf6; background: #111; padding: 10px; display: block; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>VIBE WALLET</h1>
        <p>Zero-Config MCP Server is Live</p>
        <code>${baseUrl}/sse</code>
        <p style="font-size: 12px; color: #666;">IP Isolation Active</p>
    </div>
</body>
</html>
    `);
});

httpServer.listen(PORT, HOST, () => {
    console.log(`[VIBE] Server live on port ${PORT}`);
});
