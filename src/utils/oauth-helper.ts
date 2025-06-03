import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import { randomBytes } from 'crypto';
import axios from 'axios';
import open from 'open';

// 获取 open 函数的异步加载函数
const getOpenFunction = async () => {
  try {
    return open;
  } catch (error) {
    console.warn('无法加载 open 模块，将无法自动打开浏览器:', error);
    return null;
  }
};

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // timestamp
  userId?: string;
}

export interface OAuthConfig {
  appId: string;
  appSecret: string;
  domain: string;
  scopes?: string[];
  redirectPort?: number;
}

const CONFIG_DIR = path.join(os.homedir(), '.lark-mcp');
const TOKEN_FILE = path.join(CONFIG_DIR, 'tokens.json');

export class OAuthHelper {
  private config: OAuthConfig;
  private server?: http.Server;

  constructor(config: OAuthConfig) {
    this.config = {
      ...config,
      // 只有在没有提供scopes或scopes为空数组时才使用默认值
      scopes: (config.scopes && config.scopes.length > 0) ? config.scopes : ['contact:user.email:readonly'],
      redirectPort: config.redirectPort || 3000,
    };
  }

  /**
   * 获取存储的用户访问令牌
   */
  async getStoredUserAccessToken(userId?: string): Promise<string | null> {
    try {
      const tokenData = await this.getTokenFromFile(userId);
      if (tokenData && tokenData.expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokenData.accessToken;
      }
      
      if (tokenData?.refreshToken) {
        const newToken = await this.refreshAccessToken(tokenData.refreshToken);
        if (newToken) {
          await this.storeTokenToFile(newToken, userId);
          return newToken.accessToken;
        }
      }
    } catch (error) {
      console.warn('从文件读取token失败:', error);
    }
    
    return null;
  }

  /**
   * 启动OAuth授权流程
   */
  async startOAuthFlow(): Promise<string> {
    console.error('开始用户授权流程...');
    
    // 检查是否已有有效token
    const existingToken = await this.getStoredUserAccessToken();
    if (existingToken) {
      console.error('发现有效的用户访问令牌，直接使用');
      return existingToken;
    }
    
    console.error('需要用户授权，即将在浏览器中打开授权页面...');
    
    // 生成state参数防止CSRF攻击
    const state = randomBytes(32).toString('hex');
    
    // 启动本地回调服务器
    const authCode = await this.startCallbackServer(state);
    
    // 使用授权码交换access token
    const tokenData = await this.exchangeCodeForToken(authCode);
    
    // 存储token
    await this.storeUserAccessToken(tokenData);
    
    console.error('授权成功！');
    return tokenData.accessToken;
  }

  /**
   * 启动本地回调服务器
   */
  private async startCallbackServer(state: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let resolved = false;
      
      this.server = http.createServer((req, res) => {
        if (resolved) return;
        
        const url = new URL(req.url!, `http://localhost:${this.config.redirectPort}`);
        
        if (url.pathname === '/oauth/callback') {
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h2 style="color: #e74c3c;">授权失败</h2>
                  <p>错误信息: ${error}</p>
                  <p>请关闭此页面并重试</p>
                </body>
              </html>
            `);
            resolved = true;
            reject(new Error(`OAuth授权失败: ${error}`));
            return;
          }
          
          if (!code || returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h2 style="color: #e74c3c;">授权失败</h2>
                  <p>无效的授权码或状态参数</p>
                  <p>请关闭此页面并重试</p>
                </body>
              </html>
            `);
            resolved = true;
            reject(new Error('无效的授权码或状态参数'));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: #27ae60;">授权成功！</h2>
                <p>您已成功完成授权，现在可以关闭此页面</p>
                <script>
                  setTimeout(() => {
                    window.close();
                  }, 3000);
                </script>
              </body>
            </html>
          `);
          
          resolved = true;
          resolve(code);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
      
      this.server.listen(this.config.redirectPort, () => {
        console.error(`回调服务器已启动，监听端口 ${this.config.redirectPort}`);
        
        // 构建授权URL
        const authUrl = this.buildAuthUrl(state);
        console.error('正在打开浏览器进行授权...');
        console.error(`授权URL: ${authUrl}`);
        
        // 打开浏览器
        getOpenFunction().then(open => {
          if (open) {
            open(authUrl).catch((error: any) => {
              console.error('无法自动打开浏览器，请手动访问以下URL进行授权:');
              console.error(`授权URL: ${authUrl}`);
              console.error(`错误详情: ${error.message}`);
            });
          } else {
            console.error('无法自动打开浏览器，请手动访问以下URL进行授权:');
            console.error(`授权URL: ${authUrl}`);
          }
        }).catch((error: any) => {
          console.error('无法自动打开浏览器，请手动访问以下URL进行授权:');
          console.error(`授权URL: ${authUrl}`);
          console.error(`错误详情: ${error.message}`);
        });
      });
      
      this.server.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`回调服务器启动失败: ${error.message}`));
        }
      });
      
      // 设置超时（5分钟）
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('授权超时，请重试'));
        }
      }, 5 * 60 * 1000);
    }).finally(() => {
      // 清理服务器
      if (this.server) {
        this.server.close();
        this.server = undefined;
      }
    });
  }

  /**
   * 构建授权URL
   */
  private buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
      app_id: this.config.appId,
      redirect_uri: `http://localhost:${this.config.redirectPort}/oauth/callback`,
      response_type: 'code',
      scope: this.config.scopes!.join(' '),
      state: state,
    });
    
    return `${this.config.domain}/open-apis/authen/v1/authorize?${params.toString()}`;
  }

  /**
   * 使用授权码交换access token
   */
  private async exchangeCodeForToken(code: string): Promise<TokenData> {
    try {
      const response = await axios.post(
        `${this.config.domain}/open-apis/authen/v1/access_token`,
        {
          grant_type: 'authorization_code',
          code: code,
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data.code !== 0) {
        throw new Error(`获取访问令牌失败: ${response.data.msg}`);
      }
      
      const { access_token, refresh_token, expires_in, open_id } = response.data.data;
      
      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000),
        userId: open_id,
      };
    } catch (error: any) {
      if (error.response?.data) {
        throw new Error(`交换访问令牌失败: ${error.response.data.msg || error.response.data}`);
      }
      throw new Error(`交换访问令牌失败: ${error.message}`);
    }
  }

  /**
   * 刷新访问令牌
   */
  private async refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
    try {
      const response = await axios.post(
        `${this.config.domain}/open-apis/authen/v1/refresh_access_token`,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.data.code !== 0) {
        console.warn(`刷新访问令牌失败: ${response.data.msg}`);
        return null;
      }
      
      const { access_token, refresh_token, expires_in, open_id } = response.data.data;
      
      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Date.now() + (expires_in * 1000),
        userId: open_id,
      };
    } catch (error: any) {
      console.warn(`刷新访问令牌失败: ${error.response?.data?.msg || error.message}`);
      return null;
    }
  }

  /**
   * 存储用户访问令牌
   */
  private async storeUserAccessToken(tokenData: TokenData, userId?: string): Promise<void> {
    await this.storeTokenToFile(tokenData, userId);
  }

  /**
   * 存储token到文件
   */
  private async storeTokenToFile(tokenData: TokenData, userId?: string): Promise<void> {
    // 确保配置目录存在
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    
    let tokens: Record<string, TokenData> = {};
    
    // 读取现有tokens
    if (fs.existsSync(TOKEN_FILE)) {
      try {
        const content = fs.readFileSync(TOKEN_FILE, 'utf-8');
        tokens = JSON.parse(content);
      } catch (error) {
        console.warn('读取token文件失败，将创建新文件');
      }
    }
    
    // 更新token
    tokens[userId || 'default'] = tokenData;
    
    // 写入文件
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  }

  /**
   * 从文件获取token
   */
  private async getTokenFromFile(userId?: string): Promise<TokenData | null> {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(TOKEN_FILE, 'utf-8');
      const tokens: Record<string, TokenData> = JSON.parse(content);
      return tokens[userId || 'default'] || null;
    } catch (error) {
      console.warn('读取token文件失败:', error);
      return null;
    }
  }

  /**
   * 清除存储的token
   */
  async clearStoredToken(userId?: string): Promise<void> {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const content = fs.readFileSync(TOKEN_FILE, 'utf-8');
        const tokens: Record<string, TokenData> = JSON.parse(content);
        delete tokens[userId || 'default'];
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
      }
    } catch (error) {
      console.warn('从文件删除token失败:', error);
    }
  }

  /**
   * 清除所有存储的tokens
   */
  async clearAllTokens(): Promise<void> {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
    } catch (error) {
      console.warn('删除token文件失败:', error);
    }
  }
} 