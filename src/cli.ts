#!/usr/bin/env node

import fs from 'fs';
import dotenv from 'dotenv';
import { Command } from 'commander';
import { currentVersion } from './utils/version';
import { initStdioServer, initSSEServer, initMcpServer } from './mcp-server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RecallTool } from './mcp-tool/document-tool/recall';
import { OAPI_MCP_DEFAULT_ARGS, OAPI_MCP_ENV_ARGS } from './utils/constants';
import { OAuthHelper } from './utils/oauth-helper';

dotenv.config();

const program = new Command();

program.name('lark-mcp').description('Feishu/Lark MCP Tool').version(currentVersion);

program
  .command('mcp')
  .description('Start Feishu/Lark MCP Service')
  .option('-a, --app-id <appId>', 'Feishu/Lark App ID')
  .option('-s, --app-secret <appSecret>', 'Feishu/Lark App Secret')
  .option('-d, --domain <domain>', 'Feishu/Lark Domain (default: "https://open.feishu.cn")')
  .option('-t, --tools <tools>', 'Allowed Tools List, separated by commas')
  .option('-c, --tool-name-case <toolNameCase>', 'Tool Name Case, snake or camel or kebab or dot (default: "snake")')
  .option('-l, --language <language>', 'Tools Language, zh or en (default: "en")')
  .option('-u, --user-access-token <userAccessToken>', 'User Access Token (beta)')
  .option('--token-mode <tokenMode>', 'Token Mode, auto or user_access_token or tenant_access_token (default: "auto")')
  .option('-m, --mode <mode>', 'Transport Mode, stdio or sse (default: "stdio")')
  .option('--host <host>', 'Host to listen (default: "localhost")')
  .option('-p, --port <port>', 'Port to listen in sse mode (default: "3000")')
  .option('--config <configPath>', 'Config file path (JSON)')
  .option('--oauth-port <oauthPort>', 'OAuth callback server port (default: "3000")')
  .option('--scopes <scopes>', 'OAuth permission scopes, separated by commas (e.g. "docx:document,wiki:node:read")')
  .action(async (options) => {
    let fileOptions = {};
    if (options.config) {
      try {
        const configContent = fs.readFileSync(options.config, 'utf-8');
        fileOptions = JSON.parse(configContent);
      } catch (err) {
        console.error('Failed to read config file:', err);
        process.exit(1);
      }
    }
    const mergedOptions = { ...OAPI_MCP_DEFAULT_ARGS, ...OAPI_MCP_ENV_ARGS, ...fileOptions, ...options };
    
    // 处理scopes参数
    if (mergedOptions.scopes && typeof mergedOptions.scopes === 'string') {
      mergedOptions.scopes = mergedOptions.scopes.split(',').map((scope: string) => scope.trim());
    }
    
    // 如果配置了OAuth端口，传递给OAuth helper
    if (mergedOptions.oauthPort) {
      mergedOptions.oauthRedirectPort = parseInt(mergedOptions.oauthPort);
    }
    
    const { mcpServer } = initMcpServer(mergedOptions);
    if (mergedOptions.mode === 'stdio') {
      initStdioServer(mcpServer);
    } else if (mergedOptions.mode === 'sse') {
      initSSEServer(mcpServer, mergedOptions);
    } else {
      console.error('Invalid mode:', mergedOptions.mode);
      process.exit(1);
    }
  });

program
  .command('clear-tokens')
  .description('Clear all stored user access tokens')
  .option('-a, --app-id <appId>', 'Feishu/Lark App ID (required for OAuth configuration)')
  .option('-s, --app-secret <appSecret>', 'Feishu/Lark App Secret (required for OAuth configuration)')
  .option('-d, --domain <domain>', 'Feishu/Lark Domain (default: "https://open.feishu.cn")')
  .action(async (options) => {
    const mergedOptions = { ...OAPI_MCP_DEFAULT_ARGS, ...OAPI_MCP_ENV_ARGS, ...options };
    
    if (!mergedOptions.appId || !mergedOptions.appSecret) {
      console.error('Error: 需要提供 APP_ID 和 APP_SECRET 来清除存储的令牌');
      console.error('请使用 -a 和 -s 参数，或设置环境变量 APP_ID 和 APP_SECRET');
      process.exit(1);
    }

    try {
      const oauthHelper = new OAuthHelper({
        appId: mergedOptions.appId,
        appSecret: mergedOptions.appSecret,
        domain: mergedOptions.domain,
      });

      await oauthHelper.clearAllTokens();
      console.log('✅ 所有存储的用户访问令牌已清除');
    } catch (error) {
      console.error('❌ 清除令牌时出错:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('auth')
  .description('Manually trigger OAuth authorization flow to get user access token')
  .option('-a, --app-id <appId>', 'Feishu/Lark App ID')
  .option('-s, --app-secret <appSecret>', 'Feishu/Lark App Secret')
  .option('-d, --domain <domain>', 'Feishu/Lark Domain (default: "https://open.feishu.cn")')
  .option('--oauth-port <oauthPort>', 'OAuth callback server port (default: "3000")')
  .action(async (options) => {
    const mergedOptions = { ...OAPI_MCP_DEFAULT_ARGS, ...OAPI_MCP_ENV_ARGS, ...options };
    
    if (!mergedOptions.appId || !mergedOptions.appSecret) {
      console.error('Error: 需要提供 APP_ID 和 APP_SECRET');
      console.error('请使用 -a 和 -s 参数，或设置环境变量 APP_ID 和 APP_SECRET');
      process.exit(1);
    }

    try {
      const oauthHelper = new OAuthHelper({
        appId: mergedOptions.appId,
        appSecret: mergedOptions.appSecret,
        domain: mergedOptions.domain,
        redirectPort: mergedOptions.oauthPort ? parseInt(mergedOptions.oauthPort) : 3000,
      });

      console.log('🚀 开始手动授权流程...');
      const token = await oauthHelper.startOAuthFlow();
      console.log('✅ 授权成功！用户访问令牌已保存');
      console.log(`Token: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('❌ 授权失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('recall-developer-documents')
  .description('Start Feishu/Lark Open Platform Recall MCP Service')
  .option('-d, --domain <domain>', 'Feishu Open Platform Domain', 'https://open.feishu.cn')
  .option('-m, --mode <mode>', 'Transport Mode, stdio or sse', 'stdio')
  .option('--host <host>', 'Host to listen', 'localhost')
  .option('-p, --port <port>', 'Port to listen in sse mode', '3001')
  .action((options) => {
    const server = new McpServer({
      id: 'lark-recall-mcp-server',
      name: 'Lark Recall MCP Service',
      version: currentVersion,
    });
    server.tool(RecallTool.name, RecallTool.description, RecallTool.schema, (params) =>
      RecallTool.handler(params, options),
    );
    if (options.mode === 'stdio') {
      initStdioServer(server);
    } else if (options.mode === 'sse') {
      initSSEServer(server, options);
    } else {
      console.error('Invalid mode:', options.mode);
      process.exit(1);
    }
  });

if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);

export { program };
