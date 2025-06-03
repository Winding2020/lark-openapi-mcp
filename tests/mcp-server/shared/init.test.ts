import { initMcpServer } from '../../../src/mcp-server/shared/init';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// 模拟依赖项
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
  })),
}));

// 模拟mcp-tool模块
jest.mock('../../../src/mcp-tool', () => {
  return {
    LarkMcpTool: jest.fn().mockImplementation(() => ({
      updateUserAccessToken: jest.fn(),
      registerMcpServer: jest.fn(),
    })),
    defaultToolNames: ['default-tool-1', 'default-tool-2'],
    presetTools: {
      'preset.default': ['default-tool-1', 'default-tool-2'],
    },
  };
});

// 保存原始的环境变量和console.error
const originalEnv = process.env;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

describe('initMcpServer', () => {
  beforeEach(() => {
    // 重置模拟
    jest.clearAllMocks();

    // 模拟环境变量
    process.env = { ...originalEnv };

    // 模拟 console.error
    console.error = jest.fn();

    // 模拟 process.exit
    process.exit = jest.fn() as any;
  });

  afterEach(() => {
    // 恢复原始环境变量和函数
    process.env = originalEnv;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  it('应该使用提供的凭证初始化服务器', () => {
    const options = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      host: 'localhost',
      port: '3000',
    };

    const { mcpServer, larkClient } = initMcpServer(options);

    expect(McpServer).toHaveBeenCalled();
    // 从mcp-tool模块导入LarkMcpTool
    const { LarkMcpTool } = require('../../../src/mcp-tool');
    expect(LarkMcpTool).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
      }),
    );
  });

  it('应该使用环境变量中的凭证', () => {
    process.env.APP_ID = 'env-app-id';
    process.env.APP_SECRET = 'env-app-secret';

    const options = {
      appId: 'env-app-id',
      appSecret: 'env-app-secret',
      host: 'localhost',
      port: '3000',
    };

    const { mcpServer, larkClient } = initMcpServer(options);

    // 从mcp-tool模块导入LarkMcpTool
    const { LarkMcpTool } = require('../../../src/mcp-tool');
    expect(LarkMcpTool).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'env-app-id',
        appSecret: 'env-app-secret',
      }),
    );
  });

  it('如果提供了userAccessToken，应该调用updateUserAccessToken', () => {
    const options = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      userAccessToken: 'test-user-access-token',
      host: 'localhost',
      port: '3000',
    };

    const { larkClient } = initMcpServer(options);

    expect(larkClient.updateUserAccessToken).toHaveBeenCalledWith('test-user-access-token');
  });

  it('应该处理数组形式的tools参数', () => {
    const options = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      tools: ['tool1', 'tool2'],
      host: 'localhost',
      port: '3000',
    };

    const { larkClient } = initMcpServer(options);

    // 从mcp-tool模块导入LarkMcpTool
    const { LarkMcpTool } = require('../../../src/mcp-tool');
    expect(LarkMcpTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolsOptions: expect.objectContaining({
          allowTools: ['tool1', 'tool2'],
        }),
      }),
    );
  });

  it('应该处理字符串形式的tools参数', () => {
    const options = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      tools: 'tool1,tool2',
      host: 'localhost',
      port: '3000',
    };

    const { larkClient } = initMcpServer(options);

    // 从mcp-tool模块导入LarkMcpTool
    const { LarkMcpTool } = require('../../../src/mcp-tool');
    expect(LarkMcpTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolsOptions: expect.objectContaining({
          allowTools: ['tool1', 'tool2'],
        }),
      }),
    );
  });

  it('如果凭证缺失，应该退出程序', () => {
    const options = {
      appId: '',
      appSecret: '',
      host: 'localhost',
      port: '3000',
    };

    // 清除环境变量
    delete process.env.APP_ID;
    delete process.env.APP_SECRET;

    initMcpServer(options);

    expect(console.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('应该处理preset.default工具集', () => {
    const options = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      tools: ['preset.default', 'extra-tool'],
      host: 'localhost',
      port: '3000',
    };

    // 从模块导入默认工具列表
    const { defaultToolNames } = require('../../../src/mcp-tool');

    const { larkClient } = initMcpServer(options);

    // 从mcp-tool模块导入LarkMcpTool
    const { LarkMcpTool } = require('../../../src/mcp-tool');
    // 检查是否合并了默认工具和额外的工具
    expect(LarkMcpTool).toHaveBeenCalledWith(
      expect.objectContaining({
        toolsOptions: expect.objectContaining({
          allowTools: expect.arrayContaining([...defaultToolNames, 'preset.default', 'extra-tool']),
        }),
      }),
    );
  });
});
