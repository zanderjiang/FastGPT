import { FlowNodeTypeEnum } from '../node/constant';
import {
  WorkflowIOValueTypeEnum,
  NodeOutputKeyEnum,
  FlowNodeTemplateTypeEnum,
  VariableInputEnum
} from '../constants';
import { DispatchNodeResponseKeyEnum } from '../runtime/constants';
import { FlowNodeInputItemType, FlowNodeOutputItemType } from './io.d';
import { UserModelSchema } from '../../../support/user/type';
import {
  ChatHistoryItemResType,
  ChatItemType,
  ChatItemValueItemType,
  ToolRunResponseItemType,
  UserChatItemValueItemType
} from '../../chat/type';
import { ChatNodeUsageType } from '../../../support/wallet/bill/type';
import { RuntimeNodeItemType } from '../runtime/type';
import { PluginTypeEnum } from '../../plugin/constants';
import { RuntimeEdgeItemType, StoreEdgeItemType } from './edge';
import { NextApiResponse } from 'next';
import { AppDetailType, AppSchema } from '../../app/type';
import { ParentIdType } from 'common/parentFolder/type';
import { AppTypeEnum } from 'core/app/constants';

export type FlowNodeCommonType = {
  parentNodeId?: string;
  flowNodeType: FlowNodeTypeEnum; // render node card
  abandon?: boolean; // abandon node

  avatar?: string;
  name: string;
  intro?: string; // template list intro
  showStatus?: boolean; // chatting response step status
  version: string;

  // data
  inputs: FlowNodeInputItemType[];
  outputs: FlowNodeOutputItemType[];

  // plugin data
  pluginId?: string;
  isFolder?: boolean;
  // pluginType?: AppTypeEnum;
  pluginData?: PluginDataType;
};

export type PluginDataType = {
  version: string;
  diagram?: string;
  userGuide?: string;
  courseUrl?: string;
  name?: string;
  avatar?: string;
  error?: string;
};

type HandleType = {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
};
// system template
export type FlowNodeTemplateType = FlowNodeCommonType & {
  id: string; // node id, unique
  templateType: string;

  // show handle
  sourceHandle?: HandleType;
  targetHandle?: HandleType;

  // info
  isTool?: boolean; // can be connected by tool

  // action
  forbidDelete?: boolean; // forbid delete
  unique?: boolean;

  diagram?: string; // diagram url
  courseUrl?: string; // course url
  userGuide?: string; // user guide
};

export type NodeTemplateListItemType = {
  id: string; // 系统节点-系统节点的 id， 系统插件-插件的 id，团队应用的 id
  flowNodeType: FlowNodeTypeEnum; // render node card
  parentId?: ParentIdType;
  isFolder?: boolean;
  templateType: string;
  avatar?: string;
  name: string;
  intro?: string; // template list intro
  isTool?: boolean;
  authorAvatar?: string;
  author?: string;
  unique?: boolean; // 唯一的
  currentCost?: number; // 当前积分消耗
  hasTokenFee?: boolean; // 是否配置积分
  instructions?: string; // 使用说明
  courseUrl?: string; // 教程链接
  sourceMember?: SourceMember;
};

export type NodeTemplateListType = {
  type: string;
  label: string;
  list: NodeTemplateListItemType[];
}[];

// react flow node type
export type FlowNodeItemType = FlowNodeTemplateType & {
  nodeId: string;
  parentNodeId?: string;
  isError?: boolean;
  debugResult?: {
    status: 'running' | 'success' | 'skipped' | 'failed';
    message?: string;
    showResult?: boolean; // show and hide result modal
    response?: ChatHistoryItemResType;
    isExpired?: boolean;
  };
  isFolded?: boolean;
};

// store node type
export type StoreNodeItemType = FlowNodeCommonType & {
  nodeId: string;
  // isEntry: boolean;
  position?: {
    x: number;
    y: number;
  };
};
