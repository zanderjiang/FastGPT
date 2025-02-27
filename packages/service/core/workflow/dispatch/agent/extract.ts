import { chats2GPTMessages } from '@fastgpt/global/core/chat/adapt';
import { filterGPTMessageByMaxContext, loadRequestMessages } from '../../../chat/utils';
import type { ChatItemType } from '@fastgpt/global/core/chat/type.d';
import {
  countMessagesTokens,
  countGptMessagesTokens,
  countPromptTokens
} from '../../../../common/string/tiktoken/index';
import { ChatItemValueTypeEnum, ChatRoleEnum } from '@fastgpt/global/core/chat/constants';
import { createChatCompletion } from '../../../ai/config';
import type { ContextExtractAgentItemType } from '@fastgpt/global/core/workflow/template/system/contextExtract/type';
import { NodeInputKeyEnum, NodeOutputKeyEnum } from '@fastgpt/global/core/workflow/constants';
import { DispatchNodeResponseKeyEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import type { ModuleDispatchProps } from '@fastgpt/global/core/workflow/runtime/type';
import { Prompt_ExtractJson } from '@fastgpt/global/core/ai/prompt/agent';
import { replaceVariable, sliceJsonStr } from '@fastgpt/global/common/string/tools';
import { LLMModelItemType } from '@fastgpt/global/core/ai/model.d';
import { getHistories } from '../utils';
import { getLLMModel } from '../../../ai/model';
import { formatModelChars2Points } from '../../../../support/wallet/usage/utils';
import json5 from 'json5';
import {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatCompletionTool
} from '@fastgpt/global/core/ai/type';
import { ChatCompletionRequestMessageRoleEnum } from '@fastgpt/global/core/ai/constants';
import { DispatchNodeResultType } from '@fastgpt/global/core/workflow/runtime/type';
import { chatValue2RuntimePrompt } from '@fastgpt/global/core/chat/adapt';
import { llmCompletionsBodyFormat } from '../../../ai/utils';
import { ModelTypeEnum } from '../../../../../global/core/ai/model';

type Props = ModuleDispatchProps<{
  [NodeInputKeyEnum.history]?: ChatItemType[];
  [NodeInputKeyEnum.contextExtractInput]: string;
  [NodeInputKeyEnum.extractKeys]: ContextExtractAgentItemType[];
  [NodeInputKeyEnum.description]: string;
  [NodeInputKeyEnum.aiModel]: string;
}>;
type Response = DispatchNodeResultType<{
  [NodeOutputKeyEnum.success]: boolean;
  [NodeOutputKeyEnum.contextExtractFields]: string;
}>;

type ActionProps = Props & { extractModel: LLMModelItemType };

const agentFunName = 'request_function';

export async function dispatchContentExtract(props: Props): Promise<Response> {
  const {
    externalProvider,
    node: { name },
    histories,
    params: { content, history = 6, model, description, extractKeys }
  } = props;

  if (!content) {
    return Promise.reject('Input is empty');
  }

  const extractModel = getLLMModel(model);
  const chatHistories = getHistories(history, histories);

  const { arg, inputTokens, outputTokens } = await (async () => {
    if (extractModel.toolChoice) {
      return toolChoice({
        ...props,
        histories: chatHistories,
        extractModel
      });
    }
    if (extractModel.functionCall) {
      return functionCall({
        ...props,
        histories: chatHistories,
        extractModel
      });
    }
    return completions({
      ...props,
      histories: chatHistories,
      extractModel
    });
  })();

  // remove invalid key
  for (let key in arg) {
    const item = extractKeys.find((item) => item.key === key);
    if (!item) {
      delete arg[key];
    }
    if (arg[key] === '') {
      delete arg[key];
    }
  }

  // auto fill required fields
  extractKeys.forEach((item) => {
    if (item.required && !arg[item.key]) {
      arg[item.key] = item.defaultValue || '';
    }
  });

  // auth fields
  let success = !extractKeys.find((item) => !(item.key in arg));
  // auth empty value
  if (success) {
    for (const key in arg) {
      const item = extractKeys.find((item) => item.key === key);
      if (!item) {
        success = false;
        break;
      }
    }
  }

  const { totalPoints, modelName } = formatModelChars2Points({
    model: extractModel.model,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    modelType: ModelTypeEnum.llm
  });

  return {
    [NodeOutputKeyEnum.success]: success,
    [NodeOutputKeyEnum.contextExtractFields]: JSON.stringify(arg),
    ...arg,
    [DispatchNodeResponseKeyEnum.nodeResponse]: {
      totalPoints: externalProvider.openaiAccount?.key ? 0 : totalPoints,
      model: modelName,
      query: content,
      inputTokens,
      outputTokens,
      extractDescription: description,
      extractResult: arg,
      contextTotalLen: chatHistories.length + 2
    },
    [DispatchNodeResponseKeyEnum.nodeDispatchUsages]: [
      {
        moduleName: name,
        totalPoints: externalProvider.openaiAccount?.key ? 0 : totalPoints,
        model: modelName,
        inputTokens,
        outputTokens
      }
    ]
  };
}

const getFunctionCallSchema = async ({
  extractModel,
  histories,
  params: { content, extractKeys, description }
}: ActionProps) => {
  const messages: ChatItemType[] = [
    ...histories,
    {
      obj: ChatRoleEnum.Human,
      value: [
        {
          type: ChatItemValueTypeEnum.text,
          text: {
            content: `我正在执行一个函数，需要你提供一些参数，请以 JSON 字符串格式返回这些参数，要求：
"""
${description ? `- ${description}` : ''}
- 不是每个参数都是必须生成的，如果没有合适的参数值，不要生成该参数，或返回空字符串。
- 需要结合前面的对话内容，一起生成合适的参数。
"""

本次输入内容: """${content}"""
            `
          }
        }
      ]
    }
  ];
  const adaptMessages = chats2GPTMessages({ messages, reserveId: false });
  const filterMessages = await filterGPTMessageByMaxContext({
    messages: adaptMessages,
    maxContext: extractModel.maxContext
  });
  const requestMessages = await loadRequestMessages({
    messages: filterMessages,
    useVision: false
  });

  const properties: Record<
    string,
    {
      type: string;
      description: string;
    }
  > = {};
  extractKeys.forEach((item) => {
    properties[item.key] = {
      type: item.valueType || 'string',
      description: item.desc,
      ...(item.enum ? { enum: item.enum.split('\n') } : {})
    };
  });
  // function body
  const agentFunction = {
    name: agentFunName,
    description: '需要执行的函数',
    parameters: {
      type: 'object',
      properties,
      required: []
    }
  };

  return {
    filterMessages: requestMessages,
    agentFunction
  };
};

const toolChoice = async (props: ActionProps) => {
  const { externalProvider, extractModel } = props;

  const { filterMessages, agentFunction } = await getFunctionCallSchema(props);

  const tools: ChatCompletionTool[] = [
    {
      type: 'function',
      function: agentFunction
    }
  ];

  const { response } = await createChatCompletion({
    body: llmCompletionsBodyFormat(
      {
        model: extractModel.model,
        temperature: 0.01,
        messages: filterMessages,
        tools,
        tool_choice: { type: 'function', function: { name: agentFunName } }
      },
      extractModel
    ),
    userKey: externalProvider.openaiAccount
  });

  const arg: Record<string, any> = (() => {
    try {
      return json5.parse(
        response?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || ''
      );
    } catch (error) {
      console.log(agentFunction.parameters);
      console.log(response.choices?.[0]?.message?.tool_calls?.[0]?.function);
      console.log('Your model may not support tool_call', error);
      return {};
    }
  })();

  const AIMessages: ChatCompletionMessageParam[] = [
    {
      role: ChatCompletionRequestMessageRoleEnum.Assistant,
      tool_calls: response.choices?.[0]?.message?.tool_calls
    }
  ];

  const inputTokens = await countGptMessagesTokens(filterMessages, tools);
  const outputTokens = await countGptMessagesTokens(AIMessages);
  return {
    inputTokens,
    outputTokens,
    arg
  };
};

const functionCall = async (props: ActionProps) => {
  const { externalProvider, extractModel } = props;

  const { agentFunction, filterMessages } = await getFunctionCallSchema(props);
  const functions: ChatCompletionCreateParams.Function[] = [agentFunction];

  const { response } = await createChatCompletion({
    body: llmCompletionsBodyFormat(
      {
        model: extractModel.model,
        temperature: 0.01,
        messages: filterMessages,
        function_call: {
          name: agentFunName
        },
        functions
      },
      extractModel
    ),
    userKey: externalProvider.openaiAccount
  });

  try {
    const arg = JSON.parse(response?.choices?.[0]?.message?.function_call?.arguments || '');

    const AIMessages: ChatCompletionMessageParam[] = [
      {
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        function_call: response.choices?.[0]?.message?.function_call
      }
    ];

    const inputTokens = await countGptMessagesTokens(filterMessages, undefined, functions);
    const outputTokens = await countGptMessagesTokens(AIMessages);

    return {
      arg,
      inputTokens,
      outputTokens
    };
  } catch (error) {
    console.log(response.choices?.[0]?.message);

    console.log('Your model may not support toll_call', error);

    return {
      arg: {},
      inputTokens: 0,
      outputTokens: 0
    };
  }
};

const completions = async ({
  extractModel,
  externalProvider,
  histories,
  params: { content, extractKeys, description = 'No special requirements' }
}: ActionProps) => {
  const messages: ChatItemType[] = [
    {
      obj: ChatRoleEnum.Human,
      value: [
        {
          type: ChatItemValueTypeEnum.text,
          text: {
            content: replaceVariable(extractModel.customExtractPrompt || Prompt_ExtractJson, {
              description,
              json: extractKeys
                .map((item) => {
                  const valueType = item.valueType || 'string';
                  if (valueType !== 'string' && valueType !== 'number') {
                    item.enum = undefined;
                  }

                  return `{"type":${item.valueType || 'string'}, "key":"${item.key}", "description":"${item.desc}" ${
                    item.enum ? `, "enum":"[${item.enum.split('\n')}]"` : ''
                  }}`;
                })
                .join('\n'),
              text: `${histories.map((item) => `${item.obj}:${chatValue2RuntimePrompt(item.value).text}`).join('\n')}
Human: ${content}`
            })
          }
        }
      ]
    }
  ];
  const requestMessages = await loadRequestMessages({
    messages: chats2GPTMessages({ messages, reserveId: false }),
    useVision: false
  });

  const { response: data } = await createChatCompletion({
    body: llmCompletionsBodyFormat(
      {
        model: extractModel.model,
        temperature: 0.01,
        messages: requestMessages,
        stream: false
      },
      extractModel
    ),
    userKey: externalProvider.openaiAccount
  });
  const answer = data.choices?.[0].message?.content || '';

  // parse response
  const jsonStr = sliceJsonStr(answer);

  if (!jsonStr) {
    return {
      rawResponse: answer,
      inputTokens: await countMessagesTokens(messages),
      outputTokens: await countPromptTokens(answer),
      arg: {}
    };
  }

  try {
    return {
      rawResponse: answer,
      inputTokens: await countMessagesTokens(messages),
      outputTokens: await countPromptTokens(answer),
      arg: json5.parse(jsonStr) as Record<string, any>
    };
  } catch (error) {
    console.log('Extract error, ai answer:', answer);
    console.log(error);
    return {
      rawResponse: answer,
      inputTokens: await countMessagesTokens(messages),
      outputTokens: await countPromptTokens(answer),
      arg: {}
    };
  }
};
