import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

/**
 * Call an MCP tool and return the text result.
 */
export async function callTool(client: Client, name: string, args: Record<string, any> = {}): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text: string }>;
  if (!content || content.length === 0) throw new Error(`No content in response for ${name}`);
  return content[0].text;
}

/**
 * Call an MCP tool and parse the JSON result.
 */
export async function callToolJson<T = any>(client: Client, name: string, args: Record<string, any> = {}): Promise<T> {
  const text = await callTool(client, name, args);
  return JSON.parse(text);
}

/**
 * Call an MCP tool and expect it to throw.
 */
export async function callToolExpectError(client: Client, name: string, args: Record<string, any> = {}): Promise<Error> {
  try {
    await client.callTool({ name, arguments: args });
    throw new Error(`Expected ${name} to throw but it succeeded`);
  } catch (err: any) {
    return err;
  }
}
