import { McpTool } from '../../../../types';
import { z } from 'zod';
import * as lark from '@larksuiteoapi/node-sdk';

// 简化版文档块创建工具
export const larkDocxSimplifiedCreateTool: McpTool = {
  project: 'docx',
  name: 'docx.v1.documentBlockChildren.createSimplified',
  accessTokens: ['tenant', 'user'],
  description: '[飞书/Lark]-云文档-文档-块-创建块(简化版)-为指定块创建子块，支持常用块类型和基本样式',
  schema: {
    data: z.object({
      children: z
        .array(
          z.object({
            block_type: z
              .number()
              .describe(
                '块类型 Options:2(文本块),3(标题1),4(标题2),5(标题3),12(无序列表),13(有序列表),14(代码块),15(引用块),17(待办事项),22(分割线)',
              ),
            text: z
              .object({
                content: z.string().describe('文本内容'),
                style: z
                  .object({
                    align: z
                      .number()
                      .describe('对齐方式 Options:1(左对齐),2(居中),3(右对齐)')
                      .optional(),
                    bold: z.boolean().describe('是否加粗').optional(),
                    italic: z.boolean().describe('是否斜体').optional(),
                    strikethrough: z.boolean().describe('是否删除线').optional(),
                    underline: z.boolean().describe('是否下划线').optional(),
                    text_color: z
                      .number()
                      .describe('字体颜色 Options:1(粉红),2(橙色),3(黄色),4(绿色),5(蓝色),6(紫色),7(灰色)')
                      .optional(),
                    background_color: z
                      .number()
                      .describe(
                        '背景色 Options:1(浅粉红),2(浅橙色),3(浅黄色),4(浅绿色),5(浅蓝色),6(浅紫色),7(浅灰色)',
                      )
                      .optional(),
                    language: z
                      .number()
                      .describe(
                        '代码块语言(仅block_type=14时使用) Options:1(PlainText),29(Java),30(JavaScript),43(PHP),49(Python),56(SQL),63(TypeScript)',
                      )
                      .optional(),
                    done: z.boolean().describe('待办事项完成状态(仅block_type=17时使用)').optional(),
                  })
                  .describe('文本样式')
                  .optional(),
              })
              .describe('文本内容和样式')
              .optional(),
          }),
        )
        .describe('要创建的子块列表')
        .optional(),
      index: z
        .number()
        .describe('插入位置，从0开始')
        .optional(),
    }),
    params: z.object({
      document_revision_id: z
        .number()
        .describe('文档版本，-1表示最新版本')
        .optional(),
      client_token: z
        .string()
        .describe('操作唯一标识，用于幂等操作')
        .optional(),
      user_id_type: z
        .enum(['open_id', 'union_id', 'user_id'])
        .describe('用户ID类型')
        .optional(),
    }),
    path: z.object({
      document_id: z.string().describe('文档唯一标识'),
      block_id: z.string().describe('父块的唯一标识'),
    }),
    useUAT: z.boolean().describe('使用用户身份请求, 否则使用应用身份').optional(),
  },
  // 使用自定义处理器将简化的参数转换为完整的API调用
  customHandler: async (client, params, options): Promise<any> => {
    try {
      const { userAccessToken } = options || {};
      
      // 转换简化的参数为完整的API参数
      const transformedData = {
        children: params.data.children?.map((child: any) => {
          const blockData: any = {
            block_type: child.block_type,
          };
          
          // 处理文本块
          if (child.text) {
            blockData.text = {
              style: {
                align: child.text.style?.align || 1, // 默认左对齐
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
            // 空文本块
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
        // 如果index是-1，则不传递这个参数，让API默认添加到末尾
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

      // 🔧 修复：正确处理token，采用与标准处理器相同的逻辑
      let response;
      if (params.useUAT) {
        // 如果需要使用用户访问令牌但没有token，抛出错误
        if (!userAccessToken) {
          throw new Error('Invalid UserAccessToken - 需要用户访问令牌但未提供');
        }
        // 使用用户访问令牌调用API
        response = await client.docx.v1.documentBlockChildren.create(
          requestData,
          lark.withUserAccessToken(userAccessToken)
        );
      } else {
        // 使用应用访问令牌调用API
        response = await client.docx.v1.documentBlockChildren.create(requestData);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `文档块创建成功: ${JSON.stringify(response.data)}`,
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