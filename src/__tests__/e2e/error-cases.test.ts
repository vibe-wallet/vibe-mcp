import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestEnv, type TestEnv } from './setup.js';
import { callTool, callToolExpectError, callToolJson } from './helpers.js';
import { MockExtension } from './mock-extension.js';

describe('error cases', () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await createTestEnv();
  }, 15000);

  afterAll(async () => {
    await env?.cleanup();
  }, 10000);

  it('wallet_selectInstance returns error for non-existent instance', async () => {
    const result = await callTool(env.mcpClient, 'wallet_selectInstance', {
      instanceId: 'does-not-exist',
    });
    expect(result).toContain('Error');
  });

  it('correctly forwards all 25 tool names to extension', async () => {
    const toolNames = [
      'wallet_getAddress', 'wallet_getBalance', 'wallet_getNetwork',
      'wallet_getBlockNumber', 'wallet_getGasPrice', 'wallet_getTokenBalance',
      'wallet_getTransactionHistory', 'wallet_estimateGas', 'wallet_callContract',
      'wallet_getStatus', 'wallet_switchNetwork', 'wallet_sendTransaction',
      'wallet_signMessage', 'wallet_sendToken', 'wallet_approveToken',
      'wallet_listAccounts', 'wallet_selectAccount', 'wallet_createAccount',
      'wallet_importAccount', 'wallet_deleteAccount',
      'solana_getAddress', 'solana_getBalance', 'solana_getAirdrop',
      'solana_sendTransaction', 'solana_signMessage',
    ];

    for (const name of toolNames) {
      env.mockExtension.clearRequests();
      const params = getRequiredParams(name);
      await callTool(env.mcpClient, name, params);

      expect(env.mockExtension.receivedRequests.length).toBeGreaterThanOrEqual(1);
      expect(env.mockExtension.receivedRequests[0].method).toBe(name);
    }
  });
});

describe('extension disconnect', () => {
  let env: TestEnv;

  beforeAll(async () => {
    env = await createTestEnv();
  }, 15000);

  afterAll(async () => {
    await env?.cleanup();
  }, 10000);

  it('errors when extension disconnects before request', async () => {
    // Disconnect the mock extension
    await env.mockExtension.disconnect();
    await new Promise(r => setTimeout(r, 200));

    // Should error because no paired wallet
    const err = await callToolExpectError(env.mcpClient, 'wallet_getAddress');
    expect(err.message).toMatch(/No paired wallet|no wallet|not found/i);
  });
});

function getRequiredParams(toolName: string): Record<string, any> {
  switch (toolName) {
    case 'wallet_switchNetwork': return { chain: 'sepolia' };
    case 'wallet_sendTransaction': return { to: '0x1234' };
    case 'wallet_signMessage': return { message: 'test' };
    case 'wallet_selectAccount': return { accountName: 'Tester' };
    case 'wallet_createAccount': return { name: 'Test' };
    case 'wallet_importAccount': return { name: 'Test', privateKey: '0xkey' };
    case 'wallet_deleteAccount': return { accountName: 'Test' };
    case 'solana_sendTransaction': return { to: 'addr', value: '1000' };
    case 'solana_signMessage': return { message: 'test' };
    case 'wallet_getTokenBalance': return { tokenAddress: '0xtoken' };
    case 'wallet_sendToken': return { tokenAddress: '0xtoken', to: '0xto', amount: '1' };
    case 'wallet_approveToken': return { tokenAddress: '0xtoken', spender: '0xsp', amount: '1' };
    case 'wallet_callContract': return { to: '0xaddr', data: '0xdata' };
    case 'wallet_estimateGas': return { to: '0xaddr' };
    default: return {};
  }
}
