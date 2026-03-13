import WebSocket from 'ws';

export interface MockExtensionOptions {
  port: number;
  name?: string;
  activeAccount?: string;
  autoApprove?: boolean;
}

export interface ReceivedRequest {
  id: string;
  method: string;
  params: any;
}

/**
 * Mock Chrome extension client that connects via WebSocket to the MCP server.
 * Responds to tool requests with deterministic test data.
 */
export class MockExtension {
  private ws: WebSocket | null = null;
  private options: Required<MockExtensionOptions>;
  public receivedRequests: ReceivedRequest[] = [];
  public connected = false;

  // Deterministic test data
  static readonly TEST_EVM_ADDRESS = '0x55A93790d110dA2CD144296e73494172AAb18044';
  static readonly TEST_SOLANA_ADDRESS = '2xqSjL72TTPLZCjGvHd3DYuadnpgfWh13oqJbySGEUMn';
  static readonly TEST_BALANCE_WEI = '0xde0b6b3a7640000'; // 1 ETH
  static readonly TEST_BLOCK_NUMBER = '0x1234';
  static readonly TEST_GAS_PRICE = '0x3b9aca00'; // 1 gwei
  static readonly TEST_TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  static readonly TEST_SIGNATURE = '0xsig1234567890';
  static readonly TEST_SOLANA_BALANCE = '1000000000'; // 1 SOL in lamports
  static readonly TEST_SOLANA_SIGNATURE = 'solsig1234567890abcdef';

  constructor(options: MockExtensionOptions) {
    this.options = {
      name: 'Test Wallet',
      activeAccount: 'Tester',
      autoApprove: true,
      ...options,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.options.port}/ws`);

      this.ws.on('open', () => {
        this.connected = true;
        // Send identity message like real extension does
        this.ws!.send(JSON.stringify({
          type: 'identity',
          identity: {
            name: this.options.name,
            activeAccount: this.options.activeAccount,
          },
        }));
        resolve();
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.method) {
          this.receivedRequests.push({ id: msg.id, method: msg.method, params: msg.params });
          this.handleRequest(msg);
        }
      });

      this.ws.on('ping', () => {
        // Respond to heartbeat pings
      });

      this.ws.on('error', reject);
      this.ws.on('close', () => { this.connected = false; });
    });
  }

  private handleRequest(msg: { id: string; method: string; params: any }) {
    const { id, method, params } = msg;

    try {
      const result = this.getResponse(method, params);
      this.ws!.send(JSON.stringify({ id, result }));
    } catch (err: any) {
      this.ws!.send(JSON.stringify({ id, error: { message: err.message } }));
    }
  }

  private getResponse(method: string, params: any): any {
    switch (method) {
      // EVM read tools
      case 'wallet_getAddress':
        return MockExtension.TEST_EVM_ADDRESS;
      case 'wallet_getBalance':
        return MockExtension.TEST_BALANCE_WEI;
      case 'wallet_getNetwork':
        return { chainId: '0x14a34', name: 'Base Sepolia' };
      case 'wallet_getBlockNumber':
        return MockExtension.TEST_BLOCK_NUMBER;
      case 'wallet_getGasPrice':
        return MockExtension.TEST_GAS_PRICE;
      case 'wallet_getTokenBalance':
        return '1000000'; // 1 USDC (6 decimals)
      case 'wallet_getTransactionHistory':
        return [{ hash: MockExtension.TEST_TX_HASH, type: 'send', timestamp: Date.now() }];
      case 'wallet_estimateGas':
        return '0x5208'; // 21000 gas
      case 'wallet_callContract':
        return '0x0000000000000000000000000000000000000000000000000000000000000001';
      case 'wallet_getStatus':
        return { connected: true, network: 'base-sepolia', account: 'Tester', type: 'evm' };

      // EVM write tools (sensitive)
      case 'wallet_sendTransaction':
        return MockExtension.TEST_TX_HASH;
      case 'wallet_signMessage':
      case 'personal_sign':
        return MockExtension.TEST_SIGNATURE;
      case 'wallet_sendToken':
        return MockExtension.TEST_TX_HASH;
      case 'wallet_approveToken':
        return MockExtension.TEST_TX_HASH;

      // Account management
      case 'wallet_listAccounts':
        return [
          { name: 'Tester', address: MockExtension.TEST_EVM_ADDRESS, type: 'evm' },
          { name: 'Sol Wallet', address: MockExtension.TEST_SOLANA_ADDRESS, type: 'solana' },
        ];
      case 'wallet_selectAccount':
        return `Selected ${params?.accountName || 'Tester'}`;
      case 'wallet_createAccount':
        return `Created ${params?.type || 'evm'} account ${params?.name}`;
      case 'wallet_importAccount':
        return `Imported ${params?.type || 'evm'} account ${params?.name}`;
      case 'wallet_deleteAccount':
        return `Deleted account ${params?.accountName}`;
      case 'wallet_switchNetwork':
        return `Switched to ${params?.chain}`;

      // Solana tools
      case 'solana_getAddress':
        return MockExtension.TEST_SOLANA_ADDRESS;
      case 'solana_getBalance':
        return MockExtension.TEST_SOLANA_BALANCE;
      case 'solana_getAirdrop':
        return MockExtension.TEST_SOLANA_SIGNATURE;
      case 'solana_sendTransaction':
        return MockExtension.TEST_SOLANA_SIGNATURE;
      case 'solana_signMessage':
        return MockExtension.TEST_SOLANA_SIGNATURE;

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  clearRequests(): void {
    this.receivedRequests = [];
  }
}
