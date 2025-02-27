import { getErrText } from '@fastgpt/global/common/error/utils';
import { ChatRoleEnum } from '@fastgpt/global/core/chat/constants';
import type { ChatItemType } from '@fastgpt/global/core/chat/type.d';
import {
  WorkflowIOValueTypeEnum,
  NodeOutputKeyEnum
} from '@fastgpt/global/core/workflow/constants';
import {
  RuntimeEdgeItemType,
  SystemVariablesType
} from '@fastgpt/global/core/workflow/runtime/type';
import { responseWrite } from '../../../common/response';
import { NextApiResponse } from 'next';
import { SseResponseEventEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import { getNanoid } from '@fastgpt/global/common/string/tools';
import { SearchDataResponseItemType } from '@fastgpt/global/core/dataset/type';
import json5 from 'json5';

export const getWorkflowResponseWrite = ({
  res,
  detail,
  streamResponse,
  id = getNanoid(24),
  showNodeStatus = true
}: {
  res?: NextApiResponse;
  detail: boolean;
  streamResponse: boolean;
  id?: string;
  showNodeStatus?: boolean;
}) => {
  return ({
    write,
    event,
    data,
    stream
  }: {
    write?: (text: string) => void;
    event: SseResponseEventEnum;
    data: Record<string, any>;
    stream?: boolean; // Focus set stream response
  }) => {
    const useStreamResponse = stream ?? streamResponse;

    if (!res || res.closed || !useStreamResponse) return;

    // Forbid show detail
    const detailEvent: Record<string, 1> = {
      [SseResponseEventEnum.error]: 1,
      [SseResponseEventEnum.flowNodeStatus]: 1,
      [SseResponseEventEnum.flowResponses]: 1,
      [SseResponseEventEnum.interactive]: 1,
      [SseResponseEventEnum.toolCall]: 1,
      [SseResponseEventEnum.toolParams]: 1,
      [SseResponseEventEnum.toolResponse]: 1,
      [SseResponseEventEnum.updateVariables]: 1
    };
    if (!detail && detailEvent[event]) return;

    // Forbid show running status
    const statusEvent: Record<string, 1> = {
      [SseResponseEventEnum.flowNodeStatus]: 1,
      [SseResponseEventEnum.toolCall]: 1,
      [SseResponseEventEnum.toolParams]: 1,
      [SseResponseEventEnum.toolResponse]: 1
    };
    if (!showNodeStatus && statusEvent[event]) return;

    responseWrite({
      res,
      write,
      event: detail ? event : undefined,
      data: JSON.stringify(data)
    });
  };
};

export const filterToolNodeIdByEdges = ({
  nodeId,
  edges
}: {
  nodeId: string;
  edges: RuntimeEdgeItemType[];
}) => {
  return edges
    .filter(
      (edge) => edge.source === nodeId && edge.targetHandle === NodeOutputKeyEnum.selectedTools
    )
    .map((edge) => edge.target);
};

export const getHistories = (history?: ChatItemType[] | number, histories: ChatItemType[] = []) => {
  if (!history) return [];

  const systemHistories = histories.filter((item) => item.obj === ChatRoleEnum.System);

  const filterHistories = (() => {
    if (typeof history === 'number') return histories.slice(-(history * 2));
    if (Array.isArray(history)) return history;
    return [];
  })();

  return [...systemHistories, ...filterHistories];
};

/* value type format */
export const valueTypeFormat = (value: any, type?: WorkflowIOValueTypeEnum) => {
  if (value === undefined) return;

  if (type === 'string') {
    if (typeof value !== 'object') return String(value);
    return JSON.stringify(value);
  }
  if (type === 'number') return Number(value);
  if (type === 'boolean') {
    if (typeof value === 'string') return value === 'true';
    return Boolean(value);
  }
  try {
    if (
      type &&
      [
        WorkflowIOValueTypeEnum.object,
        WorkflowIOValueTypeEnum.chatHistory,
        WorkflowIOValueTypeEnum.datasetQuote,
        WorkflowIOValueTypeEnum.selectApp,
        WorkflowIOValueTypeEnum.selectDataset
      ].includes(type) &&
      typeof value !== 'object'
    ) {
      return json5.parse(value);
    }
  } catch (error) {
    return value;
  }

  return value;
};

export const checkQuoteQAValue = (quoteQA?: SearchDataResponseItemType[]) => {
  if (!quoteQA) return undefined;
  if (quoteQA.length === 0) {
    return [];
  }
  if (quoteQA.some((item) => typeof item !== 'object' || !item.q)) {
    return undefined;
  }
  return quoteQA;
};

/* remove system variable */
export const removeSystemVariable = (
  variables: Record<string, any>,
  removeObj: Record<string, string> = {}
) => {
  const copyVariables = { ...variables };
  delete copyVariables.userId;
  delete copyVariables.appId;
  delete copyVariables.chatId;
  delete copyVariables.responseChatItemId;
  delete copyVariables.histories;
  delete copyVariables.cTime;

  // delete external provider workflow variables
  Object.keys(removeObj).forEach((key) => {
    delete copyVariables[key];
  });

  return copyVariables;
};
export const filterSystemVariables = (variables: Record<string, any>): SystemVariablesType => {
  return {
    userId: variables.userId,
    appId: variables.appId,
    chatId: variables.chatId,
    responseChatItemId: variables.responseChatItemId,
    histories: variables.histories,
    cTime: variables.cTime
  };
};

export const formatHttpError = (error: any) => {
  return {
    message: getErrText(error),
    data: error?.response?.data,
    name: error?.name,
    method: error?.config?.method,
    code: error?.code,
    status: error?.status
  };
};
