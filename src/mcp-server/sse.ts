import { initMcpServer, McpServerOptions } from './shared';
import express, { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

export function initSSEServer(server: McpServer, options: McpServerOptions) {
  const app = express();
  const transports: { [sessionId: string]: SSEServerTransport } = {};

  app.get('/sse', async (_: Request, res: Response) => {
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    res.on('close', () => {
      delete transports[transport.sessionId];
    });
    await server.connect(transport);
  });

  app.post('/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (!transport) {
      res.status(400).send('No transport found for sessionId');
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  app.listen(parseInt(options.port || '3000'), options.host || 'localhost', (error) => {
    if (error) {
      console.error('Server error:', error);
      process.exit(1);
    }
    console.log(`Server is running on port ${options.port}`);
    console.log(`SSE endpoint: http://${options.host}:${options.port}/sse`);
  });
}
