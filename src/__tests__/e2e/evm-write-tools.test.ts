import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestEnv, type TestEnv } from './setup.js';
import { callTool } from './helpers.js';
import { MockExtension } from './mock-extension.js';

let env: TestEnv;

beforeAll(async () => {
  env = await createTestEnv();
}, 15000);

afterAll(async () => {
  await env?.cleanup();
}, 10000);

describe('wallet_sendTransaction', () => {
  it('sends transaction and returns hash', async () => {
    const result = await callTool(env.mcpClient, 'wallet_sendTransaction', {
      to: MockExtension.TEST_EVM_ADDRESS,
      value: '0x1000',
    });
    expect(result).toBe(MockExtension.TEST_TX_HASH);
  });

  it('forwards to, value, and data params', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_sendTransaction', {
      to: MockExtension.TEST_EVM_ADDRESS,
      value: '0x2000',
      data: '0xabcdef',
    });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.method).toBe('wallet_sendTransaction');
    expect(req.params.to).toBe(MockExtension.TEST_EVM_ADDRESS);
    expect(req.params.value).toBe('0x2000');
    expect(req.params.data).toBe('0xabcdef');
  });
});

describe('wallet_signMessage', () => {
  it('signs message and returns signature', async () => {
    const result = await callTool(env.mcpClient, 'wallet_signMessage', {
      message: 'Hello World',
    });
    expect(result).toBe(MockExtension.TEST_SIGNATURE);
  });

  it('forwards message param', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_signMessage', { message: 'Test message' });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.message).toBe('Test message');
  });
});

describe('wallet_sendToken', () => {
  it('sends token and returns tx hash', async () => {
    const result = await callTool(env.mcpClient, 'wallet_sendToken', {
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      to: MockExtension.TEST_EVM_ADDRESS,
      amount: '100',
    });
    expect(result).toBe(MockExtension.TEST_TX_HASH);
  });

  it('forwards all token params including decimals', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_sendToken', {
      tokenAddress: '0xtoken',
      to: '0xrecipient',
      amount: '50.5',
      decimals: 6,
    });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.tokenAddress).toBe('0xtoken');
    expect(req.params.to).toBe('0xrecipient');
    expect(req.params.amount).toBe('50.5');
    expect(req.params.decimals).toBe(6);
  });
});

describe('wallet_approveToken', () => {
  it('approves token and returns tx hash', async () => {
    const result = await callTool(env.mcpClient, 'wallet_approveToken', {
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      spender: MockExtension.TEST_EVM_ADDRESS,
      amount: '1000',
    });
    expect(result).toBe(MockExtension.TEST_TX_HASH);
  });

  it('forwards unlimited amount', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_approveToken', {
      tokenAddress: '0xtoken',
      spender: '0xspender',
      amount: 'unlimited',
    });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.amount).toBe('unlimited');
  });
});
