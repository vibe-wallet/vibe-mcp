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

describe('solana_getAddress', () => {
  it('returns Solana address', async () => {
    const result = await callTool(env.mcpClient, 'solana_getAddress');
    expect(result).toBe(MockExtension.TEST_SOLANA_ADDRESS);
  });
});

describe('solana_getBalance', () => {
  it('returns Solana balance in lamports', async () => {
    const result = await callTool(env.mcpClient, 'solana_getBalance');
    expect(result).toBe(MockExtension.TEST_SOLANA_BALANCE);
  });
});

describe('solana_getAirdrop', () => {
  it('returns airdrop signature', async () => {
    const result = await callTool(env.mcpClient, 'solana_getAirdrop');
    expect(result).toBe(MockExtension.TEST_SOLANA_SIGNATURE);
  });
});

describe('solana_sendTransaction', () => {
  it('sends Solana transaction', async () => {
    const result = await callTool(env.mcpClient, 'solana_sendTransaction', {
      to: MockExtension.TEST_SOLANA_ADDRESS,
      value: '1000000',
    });
    expect(result).toBe(MockExtension.TEST_SOLANA_SIGNATURE);
  });

  it('forwards to and value params', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'solana_sendTransaction', {
      to: 'SolRecipient123',
      value: '500000',
    });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.to).toBe('SolRecipient123');
    expect(req.params.value).toBe('500000');
  });
});

describe('solana_signMessage', () => {
  it('signs a Solana message', async () => {
    const result = await callTool(env.mcpClient, 'solana_signMessage', {
      message: 'Hello Solana',
    });
    expect(result).toBe(MockExtension.TEST_SOLANA_SIGNATURE);
  });

  it('forwards message param', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'solana_signMessage', { message: 'Test sol msg' });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.message).toBe('Test sol msg');
  });
});
