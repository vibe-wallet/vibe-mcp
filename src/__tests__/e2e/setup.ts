import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server as HttpServer } from 'http';
import { MockExtension } from './mock-extension.js';

// --- Inline MCP server logic (mirrors production server/src/index.ts) ---

interface TestServerContext {
  httpServer: HttpServer;
  port: number;
  clients: Map<string, any>;
  sseSessions: Map<string, any>;
  pairings: Map<string, string>;
  pendingRequests: Map<string, any>;
}

function startMCPServer(port: number): Promise<TestServerContext> {
  return new Promise((resolve) => {
    const app = express();
    app.use(cors());
    const httpServer = createServer(app);

    const clients = new Map<string, any>();
    const sseSessions = new Map<string, any>();
    const pairings = new Map<string, string>();
    const pendingRequests = new Map<string, any>();

    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    wss.on('connection', (ws, req) => {
      const id = Math.random().toString(36).substring(7);
      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      const client: any = { id, socket: ws, ip, alive: true };
      clients.set(id, client);

      ws.on('pong', () => { client.alive = true; });
      ws.on('message', (msg) => {
        client.alive = true;
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === 'identity') {
            client.identity = data.identity;
            for (const [sseId, session] of sseSessions.entries()) {
              if (session.ip === ip) {
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
        } catch (e) { /* ignore */ }
      });
      ws.on('close', () => {
        clients.delete(id);
        for (const [sid, eid] of pairings.entries()) if (eid === id) pairings.delete(sid);
      });
    });

    function createMCPServerInstance(sseSessionId: string) {
      const server = new Server({ name: 'vibe-wallet-test', version: '1.0.0' }, { capabilities: { tools: {} } });

      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
          { name: 'wallet_listInstances', description: 'List instances', inputSchema: { type: 'object' as const } },
          { name: 'wallet_selectInstance', description: 'Select instance', inputSchema: { type: 'object' as const, properties: { instanceId: { type: 'string' } }, required: ['instanceId'] } },
          { name: 'wallet_getAddress', description: 'Get address', inputSchema: { type: 'object' as const } },
          { name: 'wallet_getBalance', description: 'Get balance', inputSchema: { type: 'object' as const } },
          { name: 'wallet_getNetwork', description: 'Get network', inputSchema: { type: 'object' as const } },
          { name: 'wallet_switchNetwork', description: 'Switch network', inputSchema: { type: 'object' as const, properties: { chain: { type: 'string' } }, required: ['chain'] } },
          { name: 'wallet_sendTransaction', description: 'Send tx', inputSchema: { type: 'object' as const, properties: { to: { type: 'string' }, value: { type: 'string' }, data: { type: 'string' } }, required: ['to'] } },
          { name: 'wallet_signMessage', description: 'Sign msg', inputSchema: { type: 'object' as const, properties: { message: { type: 'string' } }, required: ['message'] } },
          { name: 'wallet_listAccounts', description: 'List accounts', inputSchema: { type: 'object' as const } },
          { name: 'wallet_selectAccount', description: 'Select account', inputSchema: { type: 'object' as const, properties: { accountName: { type: 'string' } }, required: ['accountName'] } },
          { name: 'wallet_createAccount', description: 'Create account', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, type: { type: 'string' } }, required: ['name'] } },
          { name: 'wallet_importAccount', description: 'Import account', inputSchema: { type: 'object' as const, properties: { name: { type: 'string' }, privateKey: { type: 'string' }, type: { type: 'string' } }, required: ['name', 'privateKey'] } },
          { name: 'wallet_deleteAccount', description: 'Delete account', inputSchema: { type: 'object' as const, properties: { accountName: { type: 'string' } }, required: ['accountName'] } },
          { name: 'solana_getAddress', description: 'Solana address', inputSchema: { type: 'object' as const } },
          { name: 'solana_getBalance', description: 'Solana balance', inputSchema: { type: 'object' as const } },
          { name: 'solana_getAirdrop', description: 'Solana airdrop', inputSchema: { type: 'object' as const } },
          { name: 'solana_sendTransaction', description: 'Solana send', inputSchema: { type: 'object' as const, properties: { to: { type: 'string' }, value: { type: 'string' } }, required: ['to', 'value'] } },
          { name: 'solana_signMessage', description: 'Solana sign', inputSchema: { type: 'object' as const, properties: { message: { type: 'string' } }, required: ['message'] } },
          { name: 'wallet_getTokenBalance', description: 'Token balance', inputSchema: { type: 'object' as const, properties: { tokenAddress: { type: 'string' }, decimals: { type: 'number' } }, required: ['tokenAddress'] } },
          { name: 'wallet_sendToken', description: 'Send token', inputSchema: { type: 'object' as const, properties: { tokenAddress: { type: 'string' }, to: { type: 'string' }, amount: { type: 'string' }, decimals: { type: 'number' } }, required: ['tokenAddress', 'to', 'amount'] } },
          { name: 'wallet_approveToken', description: 'Approve token', inputSchema: { type: 'object' as const, properties: { tokenAddress: { type: 'string' }, spender: { type: 'string' }, amount: { type: 'string' }, decimals: { type: 'number' } }, required: ['tokenAddress', 'spender', 'amount'] } },
          { name: 'wallet_callContract', description: 'Call contract', inputSchema: { type: 'object' as const, properties: { to: { type: 'string' }, data: { type: 'string' } }, required: ['to', 'data'] } },
          { name: 'wallet_estimateGas', description: 'Estimate gas', inputSchema: { type: 'object' as const, properties: { to: { type: 'string' }, value: { type: 'string' }, data: { type: 'string' } }, required: ['to'] } },
          { name: 'wallet_getBlockNumber', description: 'Block number', inputSchema: { type: 'object' as const } },
          { name: 'wallet_getGasPrice', description: 'Gas price', inputSchema: { type: 'object' as const } },
          { name: 'wallet_getTransactionHistory', description: 'TX history', inputSchema: { type: 'object' as const } },
          { name: 'wallet_getStatus', description: 'Wallet status', inputSchema: { type: 'object' as const } },
        ]
      }));

      server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args } = req.params;
        const session = sseSessions.get(sseSessionId);
        if (!session) throw new Error('Session lost');

        if (name === 'wallet_listInstances') {
          const list = Array.from(clients.values())
            .filter(c => c.ip === session.ip)
            .map(c => ({ id: c.id, name: c.identity?.name || 'Unnamed', activeAccount: c.identity?.activeAccount || 'None', isActive: c.id === pairings.get(sseSessionId) }));
          return { content: [{ type: 'text' as const, text: JSON.stringify(list) }] };
        }

        if (name === 'wallet_selectInstance') {
          const { instanceId } = args as { instanceId: string };
          if (clients.has(instanceId) && clients.get(instanceId)?.ip === session.ip) {
            pairings.set(sseSessionId, instanceId);
            return { content: [{ type: 'text' as const, text: `Instance ${instanceId} selected.` }] };
          }
          return { content: [{ type: 'text' as const, text: 'Error: Instance not found on your network.' }], isError: true };
        }

        const eid = pairings.get(sseSessionId);
        const client = eid ? clients.get(eid) : null;
        if (!client) throw new Error('No paired wallet found on this machine. Ensure your browser extension is open.');

        return new Promise((resolve, reject) => {
          const id = Math.random().toString(36).substring(7);
          const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error('Extension timed out.'));
          }, 10000); // shorter timeout for tests

          pendingRequests.set(id, {
            resolve: (r: any) => resolve({ content: [{ type: 'text' as const, text: typeof r === 'string' ? r : JSON.stringify(r) }] }),
            reject: (e: any) => reject(e),
            timeout
          });
          client.socket.send(JSON.stringify({ id, method: name, params: args }));
        });
      });
      return server;
    }

    app.get('/sse', async (req: any, res: any) => {
      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      const transport = new SSEServerTransport('/sse', res);
      const sid = transport.sessionId;
      sseSessions.set(sid, { sse: transport, ip });

      const local = Array.from(clients.values()).find(c => c.ip === ip);
      if (local) pairings.set(sid, local.id);

      const server = createMCPServerInstance(sid);
      res.on('close', () => { sseSessions.delete(sid); pairings.delete(sid); });
      await server.connect(transport);
    });

    app.post('/sse', (req: any, res: any) => {
      const s = sseSessions.get(req.query.sessionId as string);
      if (s) s.sse.handlePostMessage(req, res);
      else res.status(404).end();
    });

    app.get('/health', (req, res) => res.json({ status: 'ok', clients: clients.size }));

    httpServer.listen(port, '127.0.0.1', () => {
      resolve({ httpServer, port, clients, sseSessions, pairings, pendingRequests });
    });
  });
}

// --- Test environment ---

export interface TestEnv {
  server: TestServerContext;
  mockExtension: MockExtension;
  mcpClient: Client;
  cleanup: () => Promise<void>;
}

/**
 * Create a full test environment:
 * 1. Start MCP server on random port
 * 2. Connect mock extension via WebSocket
 * 3. Connect MCP client via SSE
 */
export async function createTestEnv(): Promise<TestEnv> {
  // Pick a random port
  const port = 10000 + Math.floor(Math.random() * 50000);

  // 1. Start server
  const server = await startMCPServer(port);

  // 2. Connect mock extension
  const mockExtension = new MockExtension({ port });
  await mockExtension.connect();

  // Small delay for identity message to propagate and pairing to happen
  await new Promise(r => setTimeout(r, 100));

  // 3. Connect MCP client via SSE
  const sseUrl = new URL(`http://127.0.0.1:${port}/sse`);
  const transport = new SSEClientTransport(sseUrl);
  const mcpClient = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  await mcpClient.connect(transport);

  // Small delay for SSE session to pair with extension
  await new Promise(r => setTimeout(r, 100));

  const cleanup = async () => {
    try { await mcpClient.close(); } catch {}
    await mockExtension.disconnect();
    await new Promise<void>((resolve) => {
      server.httpServer.close(() => resolve());
    });
  };

  return { server, mockExtension, mcpClient, cleanup };
}
