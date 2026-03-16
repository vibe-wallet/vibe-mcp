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

describe('wallet_listInstances', () => {
  it('lists connected mock extension', async () => {
    const result = await callToolJson(env.mcpClient, 'wallet_listInstances');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('name', 'Test Wallet');
    expect(result[0]).toHaveProperty('isActive', true);
  });
});

describe('wallet_selectInstance', () => {
  it('selects an existing instance', async () => {
    // First get the instance list to find the ID
    const instances = await callToolJson(env.mcpClient, 'wallet_listInstances');
    const instanceId = instances[0].id;

    const result = await callTool(env.mcpClient, 'wallet_selectInstance', { instanceId });
    expect(result).toContain('selected');
  });

  it('returns error for non-existent instance', async () => {
    const result = await callTool(env.mcpClient, 'wallet_selectInstance', { instanceId: 'nonexistent' });
    expect(result).toContain('Error');
  });
});

describe('wallet_listAccounts', () => {
  it('returns accounts from mock extension', async () => {
    const result = await callToolJson(env.mcpClient, 'wallet_listAccounts');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('name', 'Tester');
    expect(result[0]).toHaveProperty('type', 'evm');
    expect(result[1]).toHaveProperty('name', 'Sol Wallet');
    expect(result[1]).toHaveProperty('type', 'solana');
  });
});

describe('wallet_selectAccount', () => {
  it('selects account by name', async () => {
    const result = await callTool(env.mcpClient, 'wallet_selectAccount', { accountName: 'Tester' });
    expect(result).toContain('Tester');
  });

  it('forwards accountName to extension', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_selectAccount', { accountName: 'Sol Wallet' });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.method).toBe('wallet_selectAccount');
    expect(req.params.accountName).toBe('Sol Wallet');
  });
});

describe('wallet_createAccount', () => {
  it('creates an EVM account', async () => {
    const result = await callTool(env.mcpClient, 'wallet_createAccount', { name: 'New EVM' });
    expect(result).toContain('Created');
    expect(result).toContain('New EVM');
  });

  it('creates a Solana account', async () => {
    const result = await callTool(env.mcpClient, 'wallet_createAccount', { name: 'New Sol', type: 'solana' });
    expect(result).toContain('Created');
    expect(result).toContain('solana');
  });

  it('forwards params to extension', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_createAccount', { name: 'Test', type: 'evm' });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.name).toBe('Test');
    expect(req.params.type).toBe('evm');
  });
});

describe('wallet_importAccount', () => {
  it('imports an account', async () => {
    const result = await callTool(env.mcpClient, 'wallet_importAccount', {
      name: 'Imported',
      privateKey: '0xabcdef1234567890',
    });
    expect(result).toContain('Imported');
  });
});

describe('wallet_deleteAccount', () => {
  it('deletes an account', async () => {
    const result = await callTool(env.mcpClient, 'wallet_deleteAccount', { accountName: 'Old Account' });
    expect(result).toContain('Deleted');
  });

  it('forwards accountName to extension', async () => {
    env.mockExtension.clearRequests();
    await callTool(env.mcpClient, 'wallet_deleteAccount', { accountName: 'ToDelete' });
    const req = env.mockExtension.receivedRequests[0];
    expect(req.params.accountName).toBe('ToDelete');
  });
});
