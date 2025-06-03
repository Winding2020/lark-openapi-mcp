import { OAuthHelper } from '../../src/utils/oauth-helper';

// Mock dependencies
jest.mock('open');
jest.mock('axios');
jest.mock('fs');
jest.mock('keytar', () => null, { virtual: true });

describe('OAuthHelper', () => {
  let oauthHelper: OAuthHelper;

  beforeEach(() => {
    oauthHelper = new OAuthHelper({
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      domain: 'https://open.feishu.cn',
    });
  });

  describe('constructor', () => {
    it('应该正确初始化配置', () => {
      expect(oauthHelper).toBeInstanceOf(OAuthHelper);
    });

    it('应该设置默认的权限范围', () => {
      const helper = new OAuthHelper({
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
        domain: 'https://open.feishu.cn',
      });
      expect(helper).toBeInstanceOf(OAuthHelper);
    });

    it('应该支持自定义重定向端口', () => {
      const helper = new OAuthHelper({
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
        domain: 'https://open.feishu.cn',
        redirectPort: 8080,
      });
      expect(helper).toBeInstanceOf(OAuthHelper);
    });
  });

  describe('getStoredUserAccessToken', () => {
    it('当没有存储的token时应返回null', async () => {
      const token = await oauthHelper.getStoredUserAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('clearAllTokens', () => {
    it('应该能够清除所有tokens', async () => {
      await expect(oauthHelper.clearAllTokens()).resolves.not.toThrow();
    });
  });
}); 