import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { noop } from '../../utils/noop';
import { currentVersion } from '../../utils/version';
import { McpServerOptions } from './types';
import * as larkmcp from '../../mcp-tool';
import { oapiHttpInstance } from '../../utils/http-instance';

export function initMcpServer(options: McpServerOptions) {
  const { appId, appSecret, userAccessToken, oauthRedirectPort } = options;

  if (!appId || !appSecret) {
    console.error(
      'Error: Missing App Credentials, please provide APP_ID and APP_SECRET or specify them via command line arguments',
    );
    process.exit(1);
  }

  let allowTools = Array.isArray(options.tools) ? options.tools : options.tools?.split(',') || [];

  for (const [presetName, presetTools] of Object.entries(larkmcp.presetTools)) {
    if (allowTools.includes(presetName)) {
      allowTools = [...presetTools, ...allowTools];
    }
  }

  // Unique
  allowTools = Array.from(new Set(allowTools));

  // Create MCP Server
  const mcpServer = new McpServer({ id: 'lark-mcp-server', name: 'Feishu/Lark MCP Server', version: currentVersion });

  const larkClient = new larkmcp.LarkMcpTool({
    appId,
    appSecret,
    logger: { warn: noop, error: noop, debug: noop, info: noop, trace: noop },
    httpInstance: oapiHttpInstance,
    domain: options.domain,
    toolsOptions: allowTools.length
      ? { allowTools: allowTools as larkmcp.ToolName[], language: options.language }
      : { language: options.language },
    tokenMode: options.tokenMode,
    oauthRedirectPort,
  });

  if (userAccessToken) {
    larkClient.updateUserAccessToken(userAccessToken);
  }

  larkClient.registerMcpServer(mcpServer, { toolNameCase: options.toolNameCase });

  return { mcpServer, larkClient };
}
