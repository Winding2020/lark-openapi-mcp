import express from 'express';
import { initSSEServer } from '../../src/mcp-server/sse';
import { McpServerOptions } from '../../src/mcp-server/shared/types';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// 创建可跟踪的模拟函数
const handlePostMessageMock = jest.fn().mockResolvedValue(undefined);
const mcpConnectMock = jest.fn().mockResolvedValue(undefined);

// 模拟依赖
jest.mock('http', () => ({
  createServer: jest.fn().mockImplementation((app) => ({
    listen: jest.fn().mockImplementation((port, host, callback) => {
      callback && callback();
      return {
        close: jest.fn(),
      };
    }),
  })),
}));

// 模拟 McpServer
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    connect: mcpConnectMock,
    server: {},
    _registeredResources: {},
    _registeredResourceTemplates: {},
    _registeredTools: {},
  })),
}));

jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn().mockImplementation((port, host, callback) => {
      if (callback) callback();
      return { close: jest.fn() };
    }),
    handlers: {
      get: null,
      post: null,
    },
    mockResponse: {
      setHeader: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      once: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    },
  };

  // 保存路由处理程序
  mockApp.get.mockImplementation((path, handler) => {
    mockApp.handlers.get = handler;
    return mockApp;
  });

  mockApp.post.mockImplementation((path, handler) => {
    mockApp.handlers.post = handler;
    return mockApp;
  });

  return jest.fn(() => mockApp);
});

jest.mock('../../src/mcp-server/shared/init', () => ({
  initMcpServer: jest.fn().mockImplementation((options) => ({
    mcpServer: {
      connect: mcpConnectMock,
    },
    larkClient: {},
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/sse.js', () => {
  const mockSessionId = 'test-session-id';
  return {
    SSEServerTransport: jest.fn().mockImplementation((path, res) => ({
      sessionId: mockSessionId,
      handlePostMessage: handlePostMessageMock,
    })),
  };
});

// 保存原始console和process.exit
const originalConsole = console;
const originalProcessExit = process.exit;

describe('initSseServer', () => {
  // 获取模拟的Express应用程序
  const mockApp = express();

  beforeEach(() => {
    // 重置模拟
    jest.clearAllMocks();

    // 模拟console和process.exit
    console.log = jest.fn();
    console.error = jest.fn();
    process.exit = jest.fn() as any;
  });

  afterEach(() => {
    // 恢复原始console和process.exit
    console = originalConsole;
    process.exit = originalProcessExit;
  });

  it('应该初始化Express应用程序并创建HTTP服务器', () => {
    const options: McpServerOptions = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      host: 'localhost',
      port: '3000',
    };

    // 创建McpServer模拟实例
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const mockServer = new McpServer();

    initSSEServer(mockServer, options);

    // 验证调用
    expect(express).toHaveBeenCalled();
    expect(mockApp.get).toHaveBeenCalledWith('/sse', expect.any(Function));
    expect(mockApp.post).toHaveBeenCalledWith('/messages', expect.any(Function));
    expect(mockApp.listen).toHaveBeenCalledWith(parseInt(options.port!), options.host, expect.any(Function));
  });

  it('应该设置SSE响应头和连接MCP服务器', async () => {
    const options: McpServerOptions = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      host: 'localhost',
      port: '3000',
    };

    // 创建McpServer模拟实例
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const mockServer = new McpServer();

    initSSEServer(mockServer, options);

    // 模拟请求和响应对象
    const req = {};
    const res = (mockApp as any).mockResponse;

    // 调用GET /sse 路由处理程序
    await (mockApp as any).handlers.get(req, res);

    // 验证SSEServerTransport创建和连接
    expect(SSEServerTransport).toHaveBeenCalledWith('/messages', res);
    expect(mcpConnectMock).toHaveBeenCalled();

    // 验证关闭事件侦听器设置
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('应该处理有效的POST消息请求', async () => {
    const options: McpServerOptions = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      host: 'localhost',
      port: '3000',
    };

    // 创建McpServer模拟实例
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const mockServer = new McpServer();

    initSSEServer(mockServer, options);

    // 首先模拟一个SSE连接，这会创建transport
    const getReq = {};
    const getRes = (mockApp as any).mockResponse;
    await (mockApp as any).handlers.get(getReq, getRes);

    // 然后模拟一个POST请求
    const postReq = {
      query: {
        sessionId: 'test-session-id',
      },
      body: { data: 'test-data' },
    };
    const postRes = (mockApp as any).mockResponse;

    // 调用POST /messages 路由处理程序
    await (mockApp as any).handlers.post(postReq, postRes);

    // 验证handlePostMessage被调用
    expect(handlePostMessageMock).toHaveBeenCalledWith(postReq, postRes);
  });

  it('应该处理无效的POST消息请求', async () => {
    const options: McpServerOptions = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      host: 'localhost',
      port: '3000',
    };

    // 创建McpServer模拟实例
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const mockServer = new McpServer();

    initSSEServer(mockServer, options);

    // 模拟一个带有无效sessionId的POST请求
    const invalidReq = {
      query: {
        sessionId: 'invalid-session-id',
      },
    };
    const res = (mockApp as any).mockResponse;

    // 调用POST /messages 路由处理程序
    await (mockApp as any).handlers.post(invalidReq, res);

    // 验证错误处理
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('No transport found for sessionId');
    expect(handlePostMessageMock).not.toHaveBeenCalled();
  });

  it('应该处理服务器错误', () => {
    const options: McpServerOptions = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      host: 'localhost',
      port: '3000',
    };

    // 修改listen以模拟错误
    (mockApp.listen as jest.Mock).mockImplementationOnce((port, host, callback) => {
      callback(new Error('Server error'));
      return { close: jest.fn() };
    });

    // 创建McpServer模拟实例
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const mockServer = new McpServer();

    initSSEServer(mockServer, options);

    // 验证错误处理
    expect(console.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('应该在客户端断开连接时清理transport', async () => {
    const options: McpServerOptions = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      host: 'localhost',
      port: '3000',
    };

    // 创建McpServer模拟实例
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const mockServer = new McpServer();

    initSSEServer(mockServer, options);

    // 模拟请求和响应对象
    const req = {};
    const res = (mockApp as any).mockResponse;

    // 调用GET /sse 路由处理程序创建transport
    await (mockApp as any).handlers.get(req, res);

    // 确保transport已创建并存储
    expect(SSEServerTransport).toHaveBeenCalledWith('/messages', res);

    // 获取并手动触发关闭回调
    type MockCall = [string, (...args: any[]) => void];
    const closeHandler = res.on.mock.calls.find((call: MockCall) => call[0] === 'close')[1];
    expect(closeHandler).toBeDefined();
    closeHandler();

    // 尝试发送带有刚才创建的会话ID的消息请求
    // 由于关闭回调已删除transport，预期会失败
    const postReq = {
      query: {
        sessionId: 'test-session-id',
      },
      body: { data: 'test-data' },
    };
    const postRes = (mockApp as any).mockResponse;

    // 调用POST /messages 路由处理程序
    await (mockApp as any).handlers.post(postReq, postRes);

    // 验证返回了错误
    expect(postRes.status).toHaveBeenCalledWith(400);
    expect(postRes.send).toHaveBeenCalledWith('No transport found for sessionId');
  });
});
