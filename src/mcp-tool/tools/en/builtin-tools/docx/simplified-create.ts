import { McpTool } from '../../../../types';
import { z } from 'zod';
import * as lark from '@larksuiteoapi/node-sdk';

// Simplified document block creation tool
export const larkDocxSimplifiedCreateTool: McpTool = {
  project: 'docx',
  name: 'docx.v1.documentBlockChildren.createSimplified',
  accessTokens: ['tenant', 'user'],
  description: '[Feishu/Lark]-Cloud Docs-Document-Block-Create Block (Simplified)-Create child blocks for specified block, supports common block types and basic styles',
  schema: {
    data: z.object({
      children: z
        .array(
          z.object({
            block_type: z
              .number()
              .describe(
                'Block type Options:2(Text),3(Heading1),4(Heading2),5(Heading3),12(Unordered List),13(Ordered List),14(Code Block),15(Quote Block),17(Todo),22(Divider)',
              ),
            text: z
              .object({
                content: z.string().describe('Text content'),
                style: z
                  .object({
                    align: z
                      .number()
                      .describe('Alignment Options:1(Left),2(Center),3(Right)')
                      .optional(),
                    bold: z.boolean().describe('Whether to bold').optional(),
                    italic: z.boolean().describe('Whether to italic').optional(),
                    strikethrough: z.boolean().describe('Whether to strikethrough').optional(),
                    underline: z.boolean().describe('Whether to underline').optional(),
                    text_color: z
                      .number()
                      .describe('Text color Options:1(Pink),2(Orange),3(Yellow),4(Green),5(Blue),6(Purple),7(Gray)')
                      .optional(),
                    background_color: z
                      .number()
                      .describe(
                        'Background color Options:1(Light Pink),2(Light Orange),3(Light Yellow),4(Light Green),5(Light Blue),6(Light Purple),7(Light Gray)',
                      )
                      .optional(),
                    language: z
                      .number()
                      .describe(
                        'Code block language (only used when block_type=14) Options:1(PlainText),29(Java),30(JavaScript),43(PHP),49(Python),56(SQL),63(TypeScript)',
                      )
                      .optional(),
                    done: z.boolean().describe('Todo completion status (only used when block_type=17)').optional(),
                  })
                  .describe('Text style')
                  .optional(),
              })
              .describe('Text content and style')
              .optional(),
          }),
        )
        .describe('List of child blocks to create')
        .optional(),
      index: z
        .number()
        .describe('Insert position, starting from 0')
        .optional(),
    }),
    params: z.object({
      document_revision_id: z
        .number()
        .describe('Document version, -1 means latest version')
        .optional(),
      client_token: z
        .string()
        .describe('Unique operation identifier for idempotent operations')
        .optional(),
      user_id_type: z
        .enum(['open_id', 'union_id', 'user_id'])
        .describe('User ID type')
        .optional(),
    }),
    path: z.object({
      document_id: z.string().describe('Document unique identifier'),
      block_id: z.string().describe('Parent block unique identifier'),
    }),
    useUAT: z.boolean().describe('Use user identity request, otherwise use application identity').optional(),
  },
  // Use custom handler to convert simplified parameters to full API call
  customHandler: async (client, params, options): Promise<any> => {
    try {
      const { userAccessToken } = options || {};
      
      // Transform simplified parameters to full API parameters
      const transformedData = {
        children: params.data.children?.map((child: any) => {
          const blockData: any = {
            block_type: child.block_type,
          };
          
          // Handle text blocks
          if (child.text) {
            blockData.text = {
              style: {
                align: child.text.style?.align || 1, // Default left align
                done: child.text.style?.done,
                language: child.text.style?.language,
                folded: false,
              },
              elements: [
                {
                  text_run: {
                    content: child.text.content || '',
                    text_element_style: {
                      bold: child.text.style?.bold || false,
                      italic: child.text.style?.italic || false,
                      strikethrough: child.text.style?.strikethrough || false,
                      underline: child.text.style?.underline || false,
                      inline_code: false,
                      text_color: child.text.style?.text_color,
                      background_color: child.text.style?.background_color,
                    },
                  },
                },
              ],
            };
          } else if (child.block_type === 2) {
            // Empty text block
            blockData.text = {
              style: {
                align: 1,
                folded: false,
              },
              elements: [
                {
                  text_run: {
                    content: '',
                    text_element_style: {
                      bold: false,
                      italic: false,
                      strikethrough: false,
                      underline: false,
                      inline_code: false,
                    },
                  },
                },
              ],
            };
          }
          
          return blockData;
        }),
        // If index is -1, don't pass this parameter, let API default to append to end
        ...(params.data.index !== undefined && params.data.index !== -1 ? { index: params.data.index } : {}),
      };

      const requestData = {
        data: transformedData,
        params: {
          document_revision_id: params.params?.document_revision_id || -1,
          client_token: params.params?.client_token,
          user_id_type: params.params?.user_id_type || 'open_id',
        },
        path: params.path,
      };

      // 🔧 Fix: Handle token correctly, using the same logic as standard processor
      let response;
      if (params.useUAT) {
        // If user access token is required but not provided, throw error
        if (!userAccessToken) {
          throw new Error('Invalid UserAccessToken - User access token required but not provided');
        }
        // Call API with user access token
        response = await client.docx.v1.documentBlockChildren.create(
          requestData,
          lark.withUserAccessToken(userAccessToken)
        );
      } else {
        // Call API with application access token
        response = await client.docx.v1.documentBlockChildren.create(requestData);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Document block created successfully: ${JSON.stringify(response.data)}`,
          },
        ],
      };
    } catch (error) {
      const errorData = (error as any)?.response?.data || error;
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Document block creation failed: ${JSON.stringify(errorData)}`,
          },
        ],
      };
    }
  },
};

export type DocxSimplifiedCreateToolName = 'docx.v1.documentBlockChildren.createSimplified'; 