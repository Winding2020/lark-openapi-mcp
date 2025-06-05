import { Client } from '@larksuiteoapi/node-sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LarkMcpToolOptions, McpTool, ToolNameCase, TokenMode } from './types';
import { AllTools, AllToolsZh } from './tools';
import { filterTools } from './utils/filter-tools';
import { defaultToolNames } from './constants';
import { larkOapiHandler } from './utils/handler';
import { caseTransf } from './utils/case-transf';
import { getShouldUseUAT } from './utils/get-should-use-uat';
import { OAuthHelper } from '../utils/oauth-helper';

/**
 * Feishu/Lark MCP
 */
export class LarkMcpTool {
  // Lark Client
  private client: Client | null = null;

  // User Access Token
  private userAccessToken: string | undefined;

  // Token Mode
  private tokenMode: TokenMode = TokenMode.AUTO;

  // All Tools
  private allTools: McpTool[] = [];

  // OAuth Helper
  private oauthHelper: OAuthHelper | null = null;

  // App credentials for OAuth
  private appId?: string;
  private appSecret?: string;
  private domain: string = 'https://open.feishu.cn';

  // 默认OAuth权限范围
  private static readonly DEFAULT_SCOPES = [
    'contact:user.email:readonly',
    'drive:drive',
    'drive:file',
    'drive:file:upload',
    'docx:document',
    'docx:document:create',
    'wiki:node:copy',
    'wiki:node:create',
    'wiki:node:move',
    'wiki:node:read',
    'wiki:node:retrieve',
    'wiki:node:update',
    'wiki:wiki'
  ];

  /**
   * Feishu/Lark MCP
   * @param options Feishu/Lark Client Options
   */
  constructor(options: LarkMcpToolOptions) {
    // Store credentials for OAuth
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.domain = (options.domain as string) || 'https://open.feishu.cn';

    if (options.client) {
      this.client = options.client;
    } else if (options.appId && options.appSecret) {
      this.client = new Client({
        appId: options.appId,
        appSecret: options.appSecret,
        ...options,
      });
    }
    this.tokenMode = options.tokenMode || TokenMode.AUTO;
    const isZH = options.toolsOptions?.language === 'zh';

    const filterOptions = {
      allowTools: defaultToolNames,
      tokenMode: this.tokenMode,
      ...options.toolsOptions,
    };
    this.allTools = filterTools(isZH ? AllToolsZh : AllTools, filterOptions);

    // Initialize OAuth helper if we have credentials
    if (this.appId && this.appSecret) {
      this.oauthHelper = new OAuthHelper({
        appId: this.appId,
        appSecret: this.appSecret,
        domain: this.domain,
        scopes: options.scopes || LarkMcpTool.DEFAULT_SCOPES,
        redirectPort: options.oauthRedirectPort || 3000,
      });
    }
  }

  /**
   * Update User Access Token
   * @param userAccessToken User Access Token
   */
  updateUserAccessToken(userAccessToken: string) {
    this.userAccessToken = userAccessToken;
  }

  /**
   * Get stored user access token or trigger OAuth flow
   * @returns User Access Token
   */
  private async ensureUserAccessToken(): Promise<string> {
    // 如果已经有token，直接返回
    if (this.userAccessToken) {
      return this.userAccessToken;
    }

    // 如果没有OAuth helper，抛出错误
    if (!this.oauthHelper) {
      throw new Error('OAuth未配置：需要提供appId和appSecret来启用自动授权');
    }

    // 首先尝试从存储中获取token
    const storedToken = await this.oauthHelper.getStoredUserAccessToken();
    if (storedToken) {
      this.userAccessToken = storedToken;
      return storedToken;
    }

    // 启动OAuth流程获取新token
    console.error('需要用户授权以使用用户身份调用API...');
    const newToken = await this.oauthHelper.startOAuthFlow();
    this.userAccessToken = newToken;
    return newToken;
  }

  /**
   * Clear stored tokens
   */
  async clearStoredTokens(): Promise<void> {
    if (this.oauthHelper) {
      await this.oauthHelper.clearAllTokens();
    }
    this.userAccessToken = undefined;
  }

  /**
   * Get MCP Tools
   * @returns MCP Tool Definition Array
   */
  getTools(): McpTool[] {
    return this.allTools;
  }

  /**
   * 获取默认的OAuth权限范围
   * @returns 默认权限范围数组
   */
  static getDefaultScopes(): string[] {
    return [...LarkMcpTool.DEFAULT_SCOPES];
  }

  /**
   * Register Tools to MCP Server
   * @param server MCP Server Instance
   */
  registerMcpServer(server: McpServer, options?: { toolNameCase?: ToolNameCase }): void {
    for (const tool of this.allTools) {
      server.tool(caseTransf(tool.name, options?.toolNameCase), tool.description, tool.schema, async (params: any) => {
        try {
          if (!this.client) {
            return {
              isError: true,
              content: [{ type: 'text' as const, text: 'Client not initialized' }],
            };
          }
          const handler = tool.customHandler || larkOapiHandler;
          
          // 检查是否需要用户访问令牌
          const shouldUseUAT = getShouldUseUAT(this.tokenMode, this.userAccessToken, params?.useUAT);
          
          let userAccessToken = this.userAccessToken;
          
          // 如果需要使用用户访问令牌但没有token，尝试获取
          if (shouldUseUAT && !userAccessToken) {
            try {
              userAccessToken = await this.ensureUserAccessToken();
            } catch (error) {
              return {
                isError: true,
                content: [{ 
                  type: 'text' as const, 
                  text: `获取用户访问令牌失败: ${(error as Error).message}。请确保：\n1. 您的应用已在飞书开放平台配置了正确的重定向URL (http://localhost:3000/oauth/callback)\n2. 应用具有相应的权限范围\n3. 网络连接正常` 
                }],
              };
            }
          }

          return handler(
            this.client,
            { ...params, useUAT: shouldUseUAT },
            { userAccessToken, tool },
          );
        } catch (error) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Error: ${JSON.stringify((error as Error)?.message)}` }],
          };
        }
      });
    }
  }
}
