import { createChatCompletion } from '../../../../ai/config';
import { filterGPTMessageByMaxContext, loadRequestMessages } from '../../../../chat/utils';
import {
  ChatCompletion,
  ChatCompletionMessageToolCall,
  StreamChatType,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionAssistantMessageParam
} from '@fastgpt/global/core/ai/type';
import { NextApiResponse } from 'next';
import { responseWriteController } from '../../../../../common/response';
import { SseResponseEventEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import { textAdaptGptResponse } from '@fastgpt/global/core/workflow/runtime/utils';
import { ChatCompletionRequestMessageRoleEnum } from '@fastgpt/global/core/ai/constants';
import { dispatchWorkFlow } from '../../index';
import { DispatchToolModuleProps, RunToolResponse, ToolNodeItemType } from './type.d';
import json5 from 'json5';
import { DispatchFlowResponse, WorkflowResponseType } from '../../type';
import { countGptMessagesTokens } from '../../../../../common/string/tiktoken/index';
import { GPTMessages2Chats } from '@fastgpt/global/core/chat/adapt';
import { AIChatItemType } from '@fastgpt/global/core/chat/type';
import { formatToolResponse, initToolCallEdges, initToolNodes } from './utils';
import { computedMaxToken, llmCompletionsBodyFormat } from '../../../../ai/utils';
import { getNanoid, sliceStrStartEnd } from '@fastgpt/global/common/string/tools';
import { toolValueTypeList } from '@fastgpt/global/core/workflow/constants';
import { WorkflowInteractiveResponseType } from '@fastgpt/global/core/workflow/template/system/interactive/type';
import { ChatItemValueTypeEnum } from '@fastgpt/global/core/chat/constants';
import { getErrText } from '@fastgpt/global/common/error/utils';

type ToolRunResponseType = {
  toolRunResponse?: DispatchFlowResponse;
  toolMsgParams: ChatCompletionToolMessageParam;
}[];

/* 
  调用思路：
  先Check 是否是交互节点触发
    
  交互模式：
  1. 从缓存中获取工作流运行数据
  2. 运行工作流
  3. 检测是否有停止信号或交互响应
    - 无：汇总结果，递归运行工具
    - 有：缓存结果，结束调用
  
  非交互模式：
  1. 组合 tools
  2. 过滤 messages
  3. Load request llm messages: system prompt, histories, human question, （assistant responses, tool responses, assistant responses....)
  4. 请求 LLM 获取结果
    
    - 有工具调用
      1. 批量运行工具的工作流，获取结果（工作流原生结果，工具执行结果）
      2. 合并递归中，所有工具的原生运行结果
      3. 组合 assistants tool 响应
      4. 组合本次 request 和 llm response 的 messages，并计算出消耗的 tokens
      5. 组合本次 request、llm response 和 tool response 结果
      6. 组合本次的 assistant responses: history assistant + tool assistant + tool child assistant
      7. 判断是否还有停止信号或交互响应
        - 无：递归运行工具
        - 有：缓存结果，结束调用
    - 无工具调用
      1. 汇总结果，递归运行工具
      2. 计算 completeMessages 和 tokens 后返回。

  交互节点额外缓存结果包括：
    1. 入口的节点 id
    2. toolCallId: 本次工具调用的 ID，可以找到是调用了哪个工具，入口并不会记录工具的 id
    3. messages：本次递归中，assistants responses 和 tool responses
*/

export const runToolWithToolChoice = async (
  props: DispatchToolModuleProps & {
    maxRunToolTimes: number;
  },
  response?: RunToolResponse
): Promise<RunToolResponse> => {
  const {
    messages,
    toolNodes,
    toolModel,
    maxRunToolTimes,
    interactiveEntryToolParams,
    ...workflowProps
  } = props;
  const {
    res,
    requestOrigin,
    runtimeNodes,
    runtimeEdges,
    stream,
    externalProvider,
    workflowStreamResponse,
    params: {
      temperature,
      maxToken,
      aiChatVision,
      aiChatTopP,
      aiChatStopSign,
      aiChatResponseFormat,
      aiChatJsonSchema
    }
  } = workflowProps;

  if (maxRunToolTimes <= 0 && response) {
    return response;
  }

  // Interactive
  if (interactiveEntryToolParams) {
    initToolNodes(runtimeNodes, interactiveEntryToolParams.entryNodeIds);
    initToolCallEdges(runtimeEdges, interactiveEntryToolParams.entryNodeIds);

    // Run entry tool
    const toolRunResponse = await dispatchWorkFlow({
      ...workflowProps,
      isToolCall: true
    });
    const stringToolResponse = formatToolResponse(toolRunResponse.toolResponses);

    // Response to frontend
    workflowStreamResponse?.({
      event: SseResponseEventEnum.toolResponse,
      data: {
        tool: {
          id: interactiveEntryToolParams.toolCallId,
          toolName: '',
          toolAvatar: '',
          params: '',
          response: sliceStrStartEnd(stringToolResponse, 5000, 5000)
        }
      }
    });

    // Check stop signal
    const hasStopSignal = toolRunResponse.flowResponses?.some((item) => item.toolStop);
    // Check interactive response(Only 1 interaction is reserved)
    const workflowInteractiveResponse = toolRunResponse.workflowInteractiveResponse;

    const requestMessages = [
      ...messages,
      ...interactiveEntryToolParams.memoryMessages.map((item) =>
        item.role === 'tool' && item.tool_call_id === interactiveEntryToolParams.toolCallId
          ? {
              ...item,
              content: stringToolResponse
            }
          : item
      )
    ];

    if (hasStopSignal || workflowInteractiveResponse) {
      // Get interactive tool data
      const toolWorkflowInteractiveResponse: WorkflowInteractiveResponseType | undefined =
        workflowInteractiveResponse
          ? {
              ...workflowInteractiveResponse,
              toolParams: {
                entryNodeIds: workflowInteractiveResponse.entryNodeIds,
                toolCallId: interactiveEntryToolParams.toolCallId,
                memoryMessages: interactiveEntryToolParams.memoryMessages
              }
            }
          : undefined;

      return {
        dispatchFlowResponse: [toolRunResponse],
        toolNodeInputTokens: 0,
        toolNodeOutputTokens: 0,
        completeMessages: requestMessages,
        assistantResponses: toolRunResponse.assistantResponses,
        runTimes: toolRunResponse.runTimes,
        toolWorkflowInteractiveResponse
      };
    }

    return runToolWithToolChoice(
      {
        ...props,
        interactiveEntryToolParams: undefined,
        maxRunToolTimes: maxRunToolTimes - 1,
        // Rewrite toolCall messages
        messages: requestMessages
      },
      {
        dispatchFlowResponse: [toolRunResponse],
        toolNodeInputTokens: 0,
        toolNodeOutputTokens: 0,
        assistantResponses: toolRunResponse.assistantResponses,
        runTimes: toolRunResponse.runTimes
      }
    );
  }

  // ------------------------------------------------------------

  const assistantResponses = response?.assistantResponses || [];

  const tools: ChatCompletionTool[] = toolNodes.map((item) => {
    const properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
        required?: boolean;
        items?: {
          type: string;
        };
      }
    > = {};
    item.toolParams.forEach((item) => {
      const jsonSchema = (
        toolValueTypeList.find((type) => type.value === item.valueType) || toolValueTypeList[0]
      )?.jsonSchema;
      properties[item.key] = {
        ...jsonSchema,
        description: item.toolDescription || '',
        enum: item.enum?.split('\n').filter(Boolean) || undefined
      };
    });

    return {
      type: 'function',
      function: {
        name: item.nodeId,
        description: item.intro || item.name,
        parameters: {
          type: 'object',
          properties,
          required: item.toolParams.filter((item) => item.required).map((item) => item.key)
        }
      }
    };
  });

  const max_tokens = computedMaxToken({
    model: toolModel,
    maxToken
  });

  // Filter histories by maxToken
  const filterMessages = (
    await filterGPTMessageByMaxContext({
      messages,
      maxContext: toolModel.maxContext - (max_tokens || 0) // filter token. not response maxToken
    })
  ).map((item) => {
    if (item.role === 'assistant' && item.tool_calls) {
      return {
        ...item,
        tool_calls: item.tool_calls.map((tool) => ({
          id: tool.id,
          type: tool.type,
          function: tool.function
        }))
      };
    }
    return item;
  });

  const [requestMessages] = await Promise.all([
    loadRequestMessages({
      messages: filterMessages,
      useVision: toolModel.vision && aiChatVision,
      origin: requestOrigin
    })
  ]);
  const requestBody = llmCompletionsBodyFormat(
    {
      model: toolModel.model,
      stream,
      messages: requestMessages,
      tools,
      tool_choice: 'auto',
      temperature,
      max_tokens,
      top_p: aiChatTopP,
      stop: aiChatStopSign,
      response_format: aiChatResponseFormat,
      json_schema: aiChatJsonSchema
    },
    toolModel
  );
  // console.log(JSON.stringify(requestMessages, null, 2), '==requestBody');
  /* Run llm */
  const {
    response: aiResponse,
    isStreamResponse,
    getEmptyResponseTip
  } = await createChatCompletion({
    body: requestBody,
    userKey: externalProvider.openaiAccount,
    options: {
      headers: {
        Accept: 'application/json, text/plain, */*'
      }
    }
  });

  const { answer, toolCalls } = await (async () => {
    if (res && isStreamResponse) {
      return streamResponse({
        res,
        workflowStreamResponse,
        toolNodes,
        stream: aiResponse
      });
    } else {
      const result = aiResponse as ChatCompletion;
      const calls = result.choices?.[0]?.message?.tool_calls || [];
      const answer = result.choices?.[0]?.message?.content || '';

      // 加上name和avatar
      const toolCalls = calls.map((tool) => {
        const toolNode = toolNodes.find((item) => item.nodeId === tool.function?.name);
        return {
          ...tool,
          toolName: toolNode?.name || '',
          toolAvatar: toolNode?.avatar || ''
        };
      });

      // 不支持 stream 模式的模型的流失响应
      toolCalls.forEach((tool) => {
        workflowStreamResponse?.({
          event: SseResponseEventEnum.toolCall,
          data: {
            tool: {
              id: tool.id,
              toolName: tool.toolName,
              toolAvatar: tool.toolAvatar,
              functionName: tool.function.name,
              params: tool.function?.arguments ?? '',
              response: ''
            }
          }
        });
      });
      if (answer) {
        workflowStreamResponse?.({
          event: SseResponseEventEnum.fastAnswer,
          data: textAdaptGptResponse({
            text: answer
          })
        });
      }

      return {
        answer,
        toolCalls: toolCalls
      };
    }
  })();
  if (!answer && toolCalls.length === 0) {
    return Promise.reject(getEmptyResponseTip());
  }

  /* Run the selected tool by LLM.
    Since only reference parameters are passed, if the same tool is run in parallel, it will get the same run parameters
  */
  const toolsRunResponse: ToolRunResponseType = [];
  for await (const tool of toolCalls) {
    try {
      const toolNode = toolNodes.find((item) => item.nodeId === tool.function?.name);

      if (!toolNode) continue;

      const startParams = (() => {
        try {
          return json5.parse(tool.function.arguments);
        } catch (error) {
          return {};
        }
      })();

      initToolNodes(runtimeNodes, [toolNode.nodeId], startParams);
      const toolRunResponse = await dispatchWorkFlow({
        ...workflowProps,
        isToolCall: true
      });

      const stringToolResponse = formatToolResponse(toolRunResponse.toolResponses);

      const toolMsgParams: ChatCompletionToolMessageParam = {
        tool_call_id: tool.id,
        role: ChatCompletionRequestMessageRoleEnum.Tool,
        name: tool.function.name,
        content: stringToolResponse
      };

      workflowStreamResponse?.({
        event: SseResponseEventEnum.toolResponse,
        data: {
          tool: {
            id: tool.id,
            toolName: '',
            toolAvatar: '',
            params: '',
            response: sliceStrStartEnd(stringToolResponse, 5000, 5000)
          }
        }
      });

      toolsRunResponse.push({
        toolRunResponse,
        toolMsgParams
      });
    } catch (error) {
      const err = getErrText(error);
      workflowStreamResponse?.({
        event: SseResponseEventEnum.toolResponse,
        data: {
          tool: {
            id: tool.id,
            toolName: '',
            toolAvatar: '',
            params: '',
            response: sliceStrStartEnd(err, 5000, 5000)
          }
        }
      });

      toolsRunResponse.push({
        toolRunResponse: undefined,
        toolMsgParams: {
          tool_call_id: tool.id,
          role: ChatCompletionRequestMessageRoleEnum.Tool,
          name: tool.function.name,
          content: sliceStrStartEnd(err, 5000, 5000)
        }
      });
    }
  }

  const flatToolsResponseData = toolsRunResponse
    .map((item) => item.toolRunResponse)
    .flat()
    .filter(Boolean) as DispatchFlowResponse[];
  // concat tool responses
  const dispatchFlowResponse = response
    ? response.dispatchFlowResponse.concat(flatToolsResponseData)
    : flatToolsResponseData;

  if (toolCalls.length > 0 && !res?.closed) {
    // Run the tool, combine its results, and perform another round of AI calls
    const assistantToolMsgParams: ChatCompletionAssistantMessageParam[] = [
      ...(answer
        ? [
            {
              role: ChatCompletionRequestMessageRoleEnum.Assistant as 'assistant',
              content: answer
            }
          ]
        : []),
      {
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        tool_calls: toolCalls
      }
    ];

    /* 
        ...
        user
        assistant: tool data
      */
    const concatToolMessages = [
      ...requestMessages,
      ...assistantToolMsgParams
    ] as ChatCompletionMessageParam[];

    // Only toolCall tokens are counted here, Tool response tokens count towards the next reply
    const inputTokens = await countGptMessagesTokens(requestMessages, tools);
    const outputTokens = await countGptMessagesTokens(assistantToolMsgParams);

    /* 
      ...
      user
      assistant: tool data
      tool: tool response
    */
    const completeMessages = [
      ...concatToolMessages,
      ...toolsRunResponse.map((item) => item?.toolMsgParams)
    ];

    /* 
      Get tool node assistant response
      history assistant
      current tool assistant
      tool child assistant
    */
    const toolNodeAssistant = GPTMessages2Chats([
      ...assistantToolMsgParams,
      ...toolsRunResponse.map((item) => item?.toolMsgParams)
    ])[0] as AIChatItemType;
    const toolChildAssistants = flatToolsResponseData
      .map((item) => item.assistantResponses)
      .flat()
      .filter((item) => item.type !== ChatItemValueTypeEnum.interactive); // 交互节点留着下次记录
    const toolNodeAssistants = [
      ...assistantResponses,
      ...toolNodeAssistant.value,
      ...toolChildAssistants
    ];

    const runTimes =
      (response?.runTimes || 0) +
      flatToolsResponseData.reduce((sum, item) => sum + item.runTimes, 0);
    const toolNodeInputTokens = response ? response.toolNodeInputTokens + inputTokens : inputTokens;
    const toolNodeOutputTokens = response
      ? response.toolNodeOutputTokens + outputTokens
      : outputTokens;

    // Check stop signal
    const hasStopSignal = flatToolsResponseData.some(
      (item) => !!item.flowResponses?.find((item) => item.toolStop)
    );
    // Check interactive response(Only 1 interaction is reserved)
    const workflowInteractiveResponseItem = toolsRunResponse.find(
      (item) => item.toolRunResponse?.workflowInteractiveResponse
    );
    if (hasStopSignal || workflowInteractiveResponseItem) {
      // Get interactive tool data
      const workflowInteractiveResponse =
        workflowInteractiveResponseItem?.toolRunResponse?.workflowInteractiveResponse;

      // Flashback traverses completeMessages, intercepting messages that know the first user
      const firstUserIndex = completeMessages.findLastIndex((item) => item.role === 'user');
      const newMessages = completeMessages.slice(firstUserIndex + 1);

      const toolWorkflowInteractiveResponse: WorkflowInteractiveResponseType | undefined =
        workflowInteractiveResponse
          ? {
              ...workflowInteractiveResponse,
              toolParams: {
                entryNodeIds: workflowInteractiveResponse.entryNodeIds,
                toolCallId: workflowInteractiveResponseItem?.toolMsgParams.tool_call_id,
                memoryMessages: newMessages
              }
            }
          : undefined;

      return {
        dispatchFlowResponse,
        toolNodeInputTokens,
        toolNodeOutputTokens,
        completeMessages,
        assistantResponses: toolNodeAssistants,
        runTimes,
        toolWorkflowInteractiveResponse
      };
    }

    return runToolWithToolChoice(
      {
        ...props,
        maxRunToolTimes: maxRunToolTimes - 1,
        messages: completeMessages
      },
      {
        dispatchFlowResponse,
        toolNodeInputTokens,
        toolNodeOutputTokens,
        assistantResponses: toolNodeAssistants,
        runTimes
      }
    );
  } else {
    // No tool is invoked, indicating that the process is over
    const gptAssistantResponse: ChatCompletionAssistantMessageParam = {
      role: ChatCompletionRequestMessageRoleEnum.Assistant,
      content: answer
    };
    const completeMessages = filterMessages.concat(gptAssistantResponse);
    const inputTokens = await countGptMessagesTokens(requestMessages, tools);
    const outputTokens = await countGptMessagesTokens([gptAssistantResponse]);

    // concat tool assistant
    const toolNodeAssistant = GPTMessages2Chats([gptAssistantResponse])[0] as AIChatItemType;

    return {
      dispatchFlowResponse: response?.dispatchFlowResponse || [],
      toolNodeInputTokens: response ? response.toolNodeInputTokens + inputTokens : inputTokens,
      toolNodeOutputTokens: response ? response.toolNodeOutputTokens + outputTokens : outputTokens,

      completeMessages,
      assistantResponses: [...assistantResponses, ...toolNodeAssistant.value],
      runTimes: (response?.runTimes || 0) + 1
    };
  }
};

async function streamResponse({
  res,
  toolNodes,
  stream,
  workflowStreamResponse
}: {
  res: NextApiResponse;
  toolNodes: ToolNodeItemType[];
  stream: StreamChatType;
  workflowStreamResponse?: WorkflowResponseType;
}) {
  const write = responseWriteController({
    res,
    readStream: stream
  });

  let textAnswer = '';
  let callingTool: { name: string; arguments: string } | null = null;
  let toolCalls: ChatCompletionMessageToolCall[] = [];

  for await (const part of stream) {
    if (res.closed) {
      stream.controller?.abort();
      break;
    }

    const responseChoice = part.choices?.[0]?.delta;

    if (responseChoice?.content) {
      const content = responseChoice.content || '';
      textAnswer += content;

      workflowStreamResponse?.({
        write,
        event: SseResponseEventEnum.answer,
        data: textAdaptGptResponse({
          text: content
        })
      });
    }
    if (responseChoice?.tool_calls?.[0]) {
      const toolCall: ChatCompletionMessageToolCall = responseChoice.tool_calls[0];
      // In a stream response, only one tool is returned at a time.  If have id, description is executing a tool
      if (toolCall.id || callingTool) {
        // Start call tool
        if (toolCall.id) {
          callingTool = {
            name: toolCall.function?.name || '',
            arguments: toolCall.function?.arguments || ''
          };
        } else if (callingTool) {
          // Continue call
          callingTool.name += toolCall.function.name || '';
          callingTool.arguments += toolCall.function.arguments || '';
        }

        const toolFunction = callingTool!;

        const toolNode = toolNodes.find((item) => item.nodeId === toolFunction.name);

        if (toolNode) {
          // New tool, add to list.
          const toolId = getNanoid();
          toolCalls.push({
            ...toolCall,
            id: toolId,
            type: 'function',
            function: toolFunction,
            toolName: toolNode.name,
            toolAvatar: toolNode.avatar
          });

          workflowStreamResponse?.({
            event: SseResponseEventEnum.toolCall,
            data: {
              tool: {
                id: toolId,
                toolName: toolNode.name,
                toolAvatar: toolNode.avatar,
                functionName: toolFunction.name,
                params: toolFunction?.arguments ?? '',
                response: ''
              }
            }
          });
          callingTool = null;
        }
      } else {
        /* arg 插入最后一个工具的参数里 */
        const arg: string = toolCall?.function?.arguments ?? '';
        const currentTool = toolCalls[toolCalls.length - 1];
        if (currentTool && arg) {
          currentTool.function.arguments += arg;

          workflowStreamResponse?.({
            write,
            event: SseResponseEventEnum.toolParams,
            data: {
              tool: {
                id: currentTool.id,
                toolName: '',
                toolAvatar: '',
                params: arg,
                response: ''
              }
            }
          });
        }
      }
    }
  }

  return { answer: textAnswer, toolCalls };
}
