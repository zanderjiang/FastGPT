import React, { useCallback, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Flex,
  Grid,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  css
} from '@chakra-ui/react';
import type {
  NodeTemplateListItemType,
  NodeTemplateListType
} from '@fastgpt/global/core/workflow/type/node.d';
import { useReactFlow, XYPosition } from 'reactflow';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { nodeTemplate2FlowNode } from '@/web/core/workflow/utils';
import { useTranslation } from 'next-i18next';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import { FlowNodeTypeEnum } from '@fastgpt/global/core/workflow/node/constant';
import {
  getPreviewPluginNode,
  getSystemPlugTemplates,
  getPluginGroups,
  getSystemPluginPaths
} from '@/web/core/app/api/plugin';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { workflowNodeTemplateList } from '@fastgpt/web/core/workflow/constants';
import FillRowTabs from '@fastgpt/web/components/common/Tabs/FillRowTabs';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useRouter } from 'next/router';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { useContextSelector } from 'use-context-selector';
import { WorkflowContext } from '../context';
import { getTeamPlugTemplates } from '@/web/core/app/api/plugin';
import { ParentIdType } from '@fastgpt/global/common/parentFolder/type';
import MyBox from '@fastgpt/web/components/common/MyBox';
import FolderPath from '@/components/common/folder/Path';
import { getAppFolderPath } from '@/web/core/app/api/app';
import { useWorkflowUtils } from './hooks/useUtils';
import { moduleTemplatesFlat } from '@fastgpt/global/core/workflow/template/constants';
import { cloneDeep } from 'lodash';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import { LoopStartNode } from '@fastgpt/global/core/workflow/template/system/loop/loopStart';
import { LoopEndNode } from '@fastgpt/global/core/workflow/template/system/loop/loopEnd';
import { NodeInputKeyEnum, NodeOutputKeyEnum } from '@fastgpt/global/core/workflow/constants';
import { WorkflowNodeEdgeContext } from '../context/workflowInitContext';
import CostTooltip from '@/components/core/app/plugin/CostTooltip';
import MyAvatar from '@fastgpt/web/components/common/Avatar';
import { useMemoizedFn } from 'ahooks';

type ModuleTemplateListProps = {
  isOpen: boolean;
  onClose: () => void;
};
type RenderHeaderProps = {
  templateType: TemplateTypeEnum;
  onClose: () => void;
  parentId: ParentIdType;
  searchKey: string;
  loadNodeTemplates: (params: any) => void;
  setSearchKey: (searchKey: string) => void;
  onUpdateParentId: (parentId: ParentIdType) => void;
};
type RenderListProps = {
  templates: NodeTemplateListItemType[];
  type: TemplateTypeEnum;
  onClose: () => void;
  parentId: ParentIdType;
  setParentId: (parenId: ParentIdType) => any;
};

enum TemplateTypeEnum {
  'basic' = 'basic',
  'systemPlugin' = 'systemPlugin',
  'teamPlugin' = 'teamPlugin'
}

const sliderWidth = 460;

const NodeTemplatesModal = ({ isOpen, onClose }: ModuleTemplateListProps) => {
  const [parentId, setParentId] = useState<ParentIdType>('');
  const [searchKey, setSearchKey] = useState('');
  const { feConfigs } = useSystemStore();
  const basicNodeTemplates = useContextSelector(WorkflowContext, (v) => v.basicNodeTemplates);
  const hasToolNode = useContextSelector(WorkflowContext, (v) => v.hasToolNode);
  const nodeList = useContextSelector(WorkflowContext, (v) => v.nodeList);
  const appId = useContextSelector(WorkflowContext, (v) => v.appId);

  const [templateType, setTemplateType] = useState(TemplateTypeEnum.basic);

  const { data: basicNodes } = useRequest2(
    async () => {
      if (templateType === TemplateTypeEnum.basic) {
        return basicNodeTemplates
          .filter((item) => {
            // unique node filter
            if (item.unique) {
              const nodeExist = nodeList.some((node) => node.flowNodeType === item.flowNodeType);
              if (nodeExist) {
                return false;
              }
            }
            // special node filter
            if (item.flowNodeType === FlowNodeTypeEnum.lafModule && !feConfigs.lafEnv) {
              return false;
            }
            // tool stop or tool params
            if (
              !hasToolNode &&
              (item.flowNodeType === FlowNodeTypeEnum.stopTool ||
                item.flowNodeType === FlowNodeTypeEnum.toolParams)
            ) {
              return false;
            }
            return true;
          })
          .map<NodeTemplateListItemType>((item) => ({
            id: item.id,
            flowNodeType: item.flowNodeType,
            templateType: item.templateType,
            avatar: item.avatar,
            name: item.name,
            intro: item.intro
          }));
      }
    },
    {
      manual: false,
      throttleWait: 100,
      refreshDeps: [basicNodeTemplates, nodeList, hasToolNode, templateType]
    }
  );
  const {
    data: teamAndSystemApps,
    loading: isLoading,
    runAsync: loadNodeTemplates
  } = useRequest2(
    async ({
      parentId = '',
      type = templateType,
      searchVal = searchKey
    }: {
      parentId?: ParentIdType;
      type?: TemplateTypeEnum;
      searchVal?: string;
    }) => {
      if (type === TemplateTypeEnum.teamPlugin) {
        return getTeamPlugTemplates({
          parentId,
          searchKey: searchVal
        }).then((res) => res.filter((app) => app.id !== appId));
      }
      if (type === TemplateTypeEnum.systemPlugin) {
        return getSystemPlugTemplates({
          searchKey: searchVal,
          parentId
        });
      }
    },
    {
      onSuccess(res, [{ parentId = '', type = templateType }]) {
        setParentId(parentId);
        setTemplateType(type);
      },
      refreshDeps: [searchKey, templateType]
    }
  );

  const templates = useMemo(
    () => basicNodes || teamAndSystemApps || [],
    [basicNodes, teamAndSystemApps]
  );

  const onUpdateParentId = useCallback(
    (parentId: ParentIdType) => {
      loadNodeTemplates({
        parentId
      });
    },
    [loadNodeTemplates]
  );

  // Init load refresh templates
  useRequest2(
    () =>
      loadNodeTemplates({
        parentId: '',
        searchVal: searchKey
      }),
    {
      manual: false,
      throttleWait: 300,
      refreshDeps: [searchKey]
    }
  );

  return (
    <>
      <Box
        zIndex={2}
        display={isOpen ? 'block' : 'none'}
        position={'absolute'}
        top={0}
        left={0}
        bottom={0}
        w={`${sliderWidth}px`}
        maxW={'100%'}
        onClick={onClose}
        fontSize={'sm'}
      />
      <MyBox
        isLoading={isLoading}
        display={'flex'}
        zIndex={3}
        flexDirection={'column'}
        position={'absolute'}
        top={'10px'}
        left={0}
        pt={5}
        pb={4}
        h={isOpen ? 'calc(100% - 20px)' : '0'}
        w={isOpen ? ['100%', `${sliderWidth}px`] : '0'}
        bg={'white'}
        boxShadow={'3px 0 20px rgba(0,0,0,0.2)'}
        borderRadius={'0 20px 20px 0'}
        transition={'.2s ease'}
        userSelect={'none'}
        overflow={isOpen ? 'none' : 'hidden'}
      >
        <RenderHeader
          templateType={templateType}
          onClose={onClose}
          parentId={parentId}
          onUpdateParentId={onUpdateParentId}
          searchKey={searchKey}
          loadNodeTemplates={loadNodeTemplates}
          setSearchKey={setSearchKey}
        />
        <RenderList
          templates={templates}
          type={templateType}
          onClose={onClose}
          parentId={parentId}
          setParentId={onUpdateParentId}
        />
      </MyBox>
    </>
  );
};

export default React.memo(NodeTemplatesModal);

const RenderHeader = React.memo(function RenderHeader({
  templateType,
  onClose,
  parentId,
  searchKey,
  setSearchKey,
  loadNodeTemplates,
  onUpdateParentId
}: RenderHeaderProps) {
  const { t } = useTranslation();
  const { feConfigs } = useSystemStore();
  const router = useRouter();

  // Get paths
  const { data: paths = [] } = useRequest2(
    () => {
      if (templateType === TemplateTypeEnum.teamPlugin) return getAppFolderPath(parentId);
      return getSystemPluginPaths(parentId);
    },
    {
      manual: false,
      refreshDeps: [parentId]
    }
  );

  return (
    <Box px={'5'} mb={3} whiteSpace={'nowrap'} overflow={'hidden'}>
      {/* Tabs */}
      <Flex flex={'1 0 0'} alignItems={'center'} gap={2}>
        <Box flex={'1 0 0'}>
          <FillRowTabs
            list={[
              {
                icon: 'core/modules/basicNode',
                label: t('common:core.module.template.Basic Node'),
                value: TemplateTypeEnum.basic
              },
              {
                icon: 'phoneTabbar/tool',
                label: t('common:navbar.Toolkit'),
                value: TemplateTypeEnum.systemPlugin
              },
              {
                icon: 'core/modules/teamPlugin',
                label: t('common:core.module.template.Team app'),
                value: TemplateTypeEnum.teamPlugin
              }
            ]}
            width={'100%'}
            py={'5px'}
            value={templateType}
            onChange={(e) => {
              loadNodeTemplates({
                type: e as TemplateTypeEnum,
                parentId: ''
              });
            }}
          />
        </Box>
        {/* close icon */}
        <IconButton
          size={'sm'}
          icon={<MyIcon name={'common/backFill'} w={'14px'} color={'myGray.600'} />}
          bg={'myGray.100'}
          _hover={{
            bg: 'myGray.200',
            '& svg': {
              color: 'primary.600'
            }
          }}
          variant={'grayBase'}
          aria-label={''}
          onClick={onClose}
        />
      </Flex>
      {/* Search */}
      {(templateType === TemplateTypeEnum.teamPlugin ||
        templateType === TemplateTypeEnum.systemPlugin) && (
        <Flex mt={2} alignItems={'center'} h={10}>
          <InputGroup mr={4} h={'full'}>
            <InputLeftElement h={'full'} alignItems={'center'} display={'flex'}>
              <MyIcon name={'common/searchLight'} w={'16px'} color={'myGray.500'} ml={3} />
            </InputLeftElement>
            <Input
              h={'full'}
              bg={'myGray.50'}
              placeholder={
                templateType === TemplateTypeEnum.teamPlugin
                  ? t('common:plugin.Search_app')
                  : t('common:plugin.Search plugin')
              }
              onChange={(e) => setSearchKey(e.target.value)}
            />
          </InputGroup>
          <Box flex={1} />
          {templateType === TemplateTypeEnum.teamPlugin && (
            <Flex
              alignItems={'center'}
              cursor={'pointer'}
              _hover={{
                color: 'primary.600'
              }}
              fontSize={'sm'}
              onClick={() => router.push('/app/list')}
              gap={1}
            >
              <Box>{t('common:create')}</Box>
              <MyIcon name={'common/rightArrowLight'} w={'0.8rem'} />
            </Flex>
          )}
          {templateType === TemplateTypeEnum.systemPlugin && feConfigs.systemPluginCourseUrl && (
            <Flex
              alignItems={'center'}
              cursor={'pointer'}
              _hover={{
                color: 'primary.600'
              }}
              fontSize={'sm'}
              onClick={() => window.open(feConfigs.systemPluginCourseUrl)}
              gap={1}
            >
              <Box>{t('common:plugin.contribute')}</Box>
              <MyIcon name={'common/rightArrowLight'} w={'0.8rem'} />
            </Flex>
          )}
        </Flex>
      )}
      {/* paths */}
      {(templateType === TemplateTypeEnum.teamPlugin ||
        templateType === TemplateTypeEnum.systemPlugin) &&
        !searchKey &&
        parentId && (
          <Flex alignItems={'center'} mt={2}>
            <FolderPath paths={paths} FirstPathDom={null} onClick={onUpdateParentId} />
          </Flex>
        )}
    </Box>
  );
});

const RenderList = React.memo(function RenderList({
  templates,
  type,
  onClose,
  setParentId
}: RenderListProps) {
  const { t } = useTranslation();
  const { setLoading } = useSystemStore();

  const { isPc } = useSystem();

  const { screenToFlowPosition } = useReactFlow();
  const { computedNewNodeName } = useWorkflowUtils();
  const { toast } = useToast();

  const setNodes = useContextSelector(WorkflowNodeEdgeContext, (v) => v.setNodes);
  const nodeList = useContextSelector(WorkflowContext, (v) => v.nodeList);

  const { data: pluginGroups = [] } = useRequest2(getPluginGroups, {
    manual: false
  });

  const formatTemplatesArray = useMemo<{ list: NodeTemplateListType; label: string }[]>(() => {
    const data = (() => {
      if (type === TemplateTypeEnum.systemPlugin) {
        return pluginGroups.map((group) => {
          const copy: NodeTemplateListType = group.groupTypes.map((type) => ({
            list: [],
            type: type.typeId,
            label: type.typeName
          }));
          templates.forEach((item) => {
            const index = copy.findIndex((template) => template.type === item.templateType);
            if (index === -1) return;
            copy[index].list.push(item);
          });
          return {
            label: group.groupName,
            list: copy.filter((item) => item.list.length > 0)
          };
        });
      }

      const copy: NodeTemplateListType = cloneDeep(workflowNodeTemplateList);
      templates.forEach((item) => {
        const index = copy.findIndex((template) => template.type === item.templateType);
        if (index === -1) return;
        copy[index].list.push(item);
      });
      return [
        {
          label: '',
          list: copy.filter((item) => item.list.length > 0)
        }
      ];
    })();
    return data.filter(({ list }) => list.length > 0);
  }, [type, templates, pluginGroups]);

  const onAddNode = useMemoizedFn(
    async ({
      template,
      position
    }: {
      template: NodeTemplateListItemType;
      position: XYPosition;
    }) => {
      // Load template node
      const templateNode = await (async () => {
        try {
          // get plugin preview module
          if (
            template.flowNodeType === FlowNodeTypeEnum.pluginModule ||
            template.flowNodeType === FlowNodeTypeEnum.appModule
          ) {
            setLoading(true);
            const res = await getPreviewPluginNode({ appId: template.id });

            setLoading(false);
            return res;
          }

          // base node
          const baseTemplate = moduleTemplatesFlat.find((item) => item.id === template.id);
          if (!baseTemplate) {
            throw new Error('baseTemplate not found');
          }
          return { ...baseTemplate };
        } catch (e) {
          toast({
            status: 'error',
            title: getErrText(e, t('common:core.plugin.Get Plugin Module Detail Failed'))
          });
          setLoading(false);
          return Promise.reject(e);
        }
      })();

      const nodePosition = screenToFlowPosition(position);
      const mouseX = nodePosition.x - 100;
      const mouseY = nodePosition.y - 20;

      // Add default values to some inputs
      const defaultValueMap: Record<string, any> = {
        [NodeInputKeyEnum.userChatInput]: undefined,
        [NodeInputKeyEnum.fileUrlList]: undefined
      };
      nodeList.forEach((node) => {
        if (node.flowNodeType === FlowNodeTypeEnum.workflowStart) {
          defaultValueMap[NodeInputKeyEnum.userChatInput] = [
            node.nodeId,
            NodeOutputKeyEnum.userChatInput
          ];
          defaultValueMap[NodeInputKeyEnum.fileUrlList] = [
            [node.nodeId, NodeOutputKeyEnum.userFiles]
          ];
        }
      });

      const newNode = nodeTemplate2FlowNode({
        template: {
          ...templateNode,
          name: computedNewNodeName({
            templateName: t(templateNode.name as any),
            flowNodeType: templateNode.flowNodeType,
            pluginId: templateNode.pluginId
          }),
          intro: t(templateNode.intro as any),
          inputs: templateNode.inputs.map((input) => ({
            ...input,
            value: defaultValueMap[input.key] ?? input.value,
            valueDesc: t(input.valueDesc as any),
            label: t(input.label as any),
            description: t(input.description as any),
            debugLabel: t(input.debugLabel as any),
            toolDescription: t(input.toolDescription as any)
          })),
          outputs: templateNode.outputs.map((output) => ({
            ...output,
            valueDesc: t(output.valueDesc as any),
            label: t(output.label as any),
            description: t(output.description as any)
          }))
        },
        position: { x: mouseX, y: mouseY },
        selected: true,
        t
      });
      const newNodes = [newNode];

      if (templateNode.flowNodeType === FlowNodeTypeEnum.loop) {
        const startNode = nodeTemplate2FlowNode({
          template: LoopStartNode,
          position: { x: mouseX + 60, y: mouseY + 280 },
          parentNodeId: newNode.id,
          t
        });
        const endNode = nodeTemplate2FlowNode({
          template: LoopEndNode,
          position: { x: mouseX + 420, y: mouseY + 680 },
          parentNodeId: newNode.id,
          t
        });

        newNodes.push(startNode, endNode);
      }

      setNodes((state) => {
        const newState = state
          .map((node) => ({
            ...node,
            selected: false
          }))
          // @ts-ignore
          .concat(newNodes);
        return newState;
      });
    }
  );

  const gridStyle = useMemo(() => {
    if (type === TemplateTypeEnum.teamPlugin) {
      return {
        gridTemplateColumns: ['1fr', '1fr'],
        py: 2,
        avatarSize: '2rem',
        authorInName: false,
        authorInRight: true
      };
    }

    return {
      gridTemplateColumns: ['1fr', '1fr 1fr'],
      py: 3,
      avatarSize: '1.75rem',
      authorInName: true,
      authorInRight: false
    };
  }, [type]);

  const PluginListRender = useMemoizedFn(({ list = [] }: { list: NodeTemplateListType }) => {
    return (
      <>
        {list.map((item, i) => {
          return (
            <Box
              key={item.type}
              css={css({
                span: {
                  display: 'block'
                }
              })}
            >
              <Flex>
                <Box fontSize={'sm'} my={2} fontWeight={'500'} flex={1} color={'myGray.900'}>
                  {t(item.label as any)}
                </Box>
              </Flex>
              <Grid gridTemplateColumns={gridStyle.gridTemplateColumns} rowGap={2}>
                {item.list.map((template) => {
                  return (
                    <MyTooltip
                      key={template.id}
                      placement={'right'}
                      label={
                        <Box py={2}>
                          <Flex alignItems={'center'}>
                            <MyAvatar
                              src={template.avatar}
                              w={'1.75rem'}
                              objectFit={'contain'}
                              borderRadius={'sm'}
                            />
                            <Box fontWeight={'bold'} ml={3} color={'myGray.900'}>
                              {t(template.name as any)}
                            </Box>
                          </Flex>
                          <Box mt={2} color={'myGray.500'} maxH={'100px'} overflow={'hidden'}>
                            {t(template.intro as any) || t('common:core.workflow.Not intro')}
                          </Box>
                          {type === TemplateTypeEnum.systemPlugin && (
                            <CostTooltip
                              cost={template.currentCost}
                              hasTokenFee={template.hasTokenFee}
                            />
                          )}
                        </Box>
                      }
                    >
                      <Flex
                        alignItems={'center'}
                        py={gridStyle.py}
                        px={3}
                        cursor={'pointer'}
                        _hover={{ bg: 'myWhite.600' }}
                        borderRadius={'sm'}
                        draggable={!template.isFolder}
                        onDragEnd={(e) => {
                          if (e.clientX < sliderWidth) return;
                          onAddNode({
                            template,
                            position: { x: e.clientX, y: e.clientY }
                          });
                        }}
                        onClick={(e) => {
                          if (template.isFolder) {
                            return setParentId(template.id);
                          }
                          if (isPc) {
                            return onAddNode({
                              template,
                              position: { x: sliderWidth * 1.5, y: 200 }
                            });
                          }
                          onAddNode({
                            template,
                            position: { x: e.clientX, y: e.clientY }
                          });
                          onClose();
                        }}
                        whiteSpace={'nowrap'}
                        overflow={'hidden'}
                        textOverflow={'ellipsis'}
                      >
                        <MyAvatar
                          src={template.avatar}
                          w={gridStyle.avatarSize}
                          objectFit={'contain'}
                          borderRadius={'sm'}
                          flexShrink={0}
                        />
                        <Box
                          color={'myGray.900'}
                          fontWeight={'500'}
                          fontSize={'sm'}
                          flex={'1 0 0'}
                          ml={3}
                          className="textEllipsis"
                        >
                          {t(template.name as any)}
                        </Box>

                        {gridStyle.authorInRight && template.authorAvatar && template.author && (
                          <HStack spacing={1} maxW={'120px'} flexShrink={0}>
                            <MyAvatar src={template.authorAvatar} w={'1rem'} borderRadius={'50%'} />
                            <Box fontSize={'xs'} className="textEllipsis">
                              {template.author}
                            </Box>
                          </HStack>
                        )}
                      </Flex>
                    </MyTooltip>
                  );
                })}
              </Grid>
            </Box>
          );
        })}
      </>
    );
  });

  return templates.length === 0 ? (
    <EmptyTip text={t('app:module.No Modules')} />
  ) : (
    <Box flex={'1 0 0'} overflow={'overlay'} px={formatTemplatesArray.length > 1 ? 2 : 5}>
      <Accordion defaultIndex={[0]} allowMultiple reduceMotion>
        {formatTemplatesArray.length > 1 ? (
          <>
            {formatTemplatesArray.map(({ list, label }, index) => (
              <AccordionItem key={index} border={'none'}>
                <AccordionButton
                  fontSize={'sm'}
                  fontWeight={'500'}
                  color={'myGray.900'}
                  justifyContent={'space-between'}
                  alignItems={'center'}
                  borderRadius={'md'}
                  px={3}
                >
                  {t(label as any)}
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel py={0}>
                  <PluginListRender list={list} />
                </AccordionPanel>
              </AccordionItem>
            ))}
          </>
        ) : (
          <PluginListRender list={formatTemplatesArray?.[0]?.list} />
        )}
      </Accordion>
    </Box>
  );
});
