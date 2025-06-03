import { currentVersion } from './version';

export const USER_AGENT = `oapi-sdk-mcp/${currentVersion}`;

export const OAPI_MCP_DEFAULT_ARGS = {
  domain: 'https://open.feishu.cn',
  toolNameCase: 'snake',
  language: 'en',
  tokenMode: 'auto',
  mode: 'stdio',
  host: 'localhost',
  port: '3000',
};

export const OAPI_MCP_ENV_ARGS = {
  ...(process.env.APP_ID && { appId: process.env.APP_ID }),
  ...(process.env.APP_SECRET && { appSecret: process.env.APP_SECRET }),
  ...(process.env.USER_ACCESS_TOKEN && { userAccessToken: process.env.USER_ACCESS_TOKEN }),
  ...(process.env.LARK_TOKEN_MODE && { tokenMode: process.env.LARK_TOKEN_MODE }),
  ...(process.env.LARK_TOOLS && { tools: process.env.LARK_TOOLS }),
  ...(process.env.LARK_DOMAIN && { domain: process.env.LARK_DOMAIN }),
};
