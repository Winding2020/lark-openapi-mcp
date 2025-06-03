import * as larkmcp from '../../mcp-tool';
import { ToolNameCase, TokenMode } from '../../mcp-tool/types';

export interface McpServerOptions {
  appId: string;
  appSecret: string;
  userAccessToken?: string;
  oauthRedirectPort?: number;
  tools?: string[] | string;
  toolNameCase?: ToolNameCase;
  language?: 'zh' | 'en';
  tokenMode?: TokenMode;
  mode?: 'stdio' | 'sse';
  host?: string;
  port?: string;
  domain?: string;
}
