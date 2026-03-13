import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestEnv, type TestEnv } from './setup.js';
import { callTool, callToolJson } from './helpers.js';
import { MockExtension } from './mock-extension.js';

let env: TestEnv;

beforeAll(async () => {
  env = await createTestEnv();
}, 15000);

afterAll(async () => {
  await env?.cleanup();
}, 10000);

describe('wallet_getAddress', () => {
  it('returns the EVM address from mock extension', async () => {
    const result = await callTool(env.mcpClient, 'wallet_getAddress');
    expect(result).toBe(MockExtension.TEST_EVM_ADDRESS);
  });

  it('sends correct method to extension', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_getAddress');
    expect(env.mockExtension.receivedRequests).toHaveLength(1);
    expect(env.mockExtension.receivedRequests[0].method).toBe('wallet_getAddress');
  });
});

describe('wallet_getBalance', () => {
  it('returns balance in hex wei', async () => {
    const result = await callTool(env.mcpClient, 'wallet_getBalance');
    expect(result).toBe(MockExtension.TEST_BALANCE_WEI);
  });
});

describe('wallet_getNetwork', () => {
  it('returns network info as JSON', async () => {
    const result = await callToolJson(env.mcpClient, 'wallet_getNetwork');
    expect(result).toHaveProperty('chainId');
    expect(result).toHaveProperty('name');
    expect(result.name).toBe('Base Sepolia');
  });
});

describe('wallet_getBlockNumber', () => {
  it('returns block number in hex', async () => {
    const result = await callTool(env.mcpClient, 'wallet_getBlockNumber');
    expect(result).toBe(MockExtension.TEST_BLOCK_NUMBER);
  });
});

describe('wallet_getGasPrice', () => {
  it('returns gas price in hex', async () => {
    const result = await callTool(env.mcpClient, 'wallet_getGasPrice');
    expect(result).toBe(MockExtension.TEST_GAS_PRICE);
  });
});

describe('wallet_getTokenBalance', () => {
  it('returns token balance', async () => {
    const result = await callTool(env.mcpClient, 'wallet_getTokenBalance', {
      tokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
    });
    expect(result).toBe('1000000');
  });

  it('forwards tokenAddress param to extension', async () => {
    env.mockExtension.clearRequests();
    const tokenAddr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    await callTool(env.mcpClient, 'wallet_getTokenBalance', { tokenAddress: tokenAddr });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.tokenAddress).toBe(tokenAddr);
  });
});

describe('wallet_getTransactionHistory', () => {
  it('returns transaction history array', async () => {
    const result = await callToolJson(env.mcpClient, 'wallet_getTransactionHistory');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('hash');
  });
});

describe('wallet_estimateGas', () => {
  it('returns gas estimate in hex', async () => {
    const result = await callTool(env.mcpClient, 'wallet_estimateGas', {
      to: MockExtension.TEST_EVM_ADDRESS,
    });
    expect(result).toBe('0x5208');
  });
});

describe('wallet_callContract', () => {
  it('returns contract call result', async () => {
    const result = await callTool(env.mcpClient, 'wallet_callContract', {
      to: MockExtension.TEST_EVM_ADDRESS,
      data: '0x70a08231',
    });
    expect(result).toMatch(/^0x/);
  });
});

describe('wallet_getStatus', () => {
  it('returns status with connection info', async () => {
    const result = await callToolJson(env.mcpClient, 'wallet_getStatus');
    expect(result.connected).toBe(true);
    expect(result.network).toBe('base-sepolia');
    expect(result.account).toBe('Tester');
  });
});

describe('wallet_switchNetwork', () => {
  it('switches network and returns confirmation', async () => {
    const result = await callTool(env.mcpClient, 'wallet_switchNetwork', {
      chain: 'sepolia',
    });
    expect(result).toContain('sepolia');
  });

  it('forwards chain param to extension', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_switchNetwork', { chain: 'arbitrum-sepolia' });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.chain).toBe('arbitrum-sepolia');
  });
});
