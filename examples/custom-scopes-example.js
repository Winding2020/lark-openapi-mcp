/**
 * 自定义OAuth权限范围示例
 * Custom OAuth Scopes Example
 */

import { LarkMcpTool } from '@larksuiteoapi/lark-mcp';

// 获取默认权限范围
const defaultScopes = LarkMcpTool.getDefaultScopes();
console.log('默认权限范围:', defaultScopes);

// 示例1: 使用默认权限范围
const toolWithDefaultScopes = new LarkMcpTool({
  appId: 'your_app_id',
  appSecret: 'your_app_secret',
  // 不设置scopes，将使用默认的完整权限集合
});

// 示例2: 使用自定义权限范围 - 仅文档相关权限
const toolWithDocumentScopes = new LarkMcpTool({
  appId: 'your_app_id',
  appSecret: 'your_app_secret',
  scopes: [
    'contact:user.email:readonly',
    'docx:document',
    'docx:document:create',
    'wiki:node:read',
    'wiki:node:create',
    'wiki:node:update'
  ]
});

// 示例3: 使用自定义权限范围 - 仅即时消息相关权限
const toolWithImScopes = new LarkMcpTool({
  appId: 'your_app_id',
  appSecret: 'your_app_secret',
  scopes: [
    'contact:user.email:readonly',
    'im:message',
    'im:chat'
  ]
});

// 示例4: 最小权限范围配置
const toolWithMinimalScopes = new LarkMcpTool({
  appId: 'your_app_id',
  appSecret: 'your_app_secret',
  scopes: [
    'contact:user.email:readonly'  // 仅用户基本信息读取权限
  ]
});

console.log('自定义scopes配置示例已创建');
console.log('您可以根据实际使用的API来调整权限范围，减少用户授权时的权限申请'); 