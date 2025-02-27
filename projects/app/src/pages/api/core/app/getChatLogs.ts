import type { NextApiRequest, NextApiResponse } from 'next';
import { MongoChat } from '@fastgpt/service/core/chat/chatSchema';
import { AppLogsListItemType } from '@/types/app';
import { Types } from '@fastgpt/service/common/mongo';
import { addDays } from 'date-fns';
import type { GetAppChatLogsParams } from '@/global/core/api/appReq.d';
import { authApp } from '@fastgpt/service/support/permission/app/auth';
import { ChatItemCollectionName } from '@fastgpt/service/core/chat/chatItemSchema';
import { NextAPI } from '@/service/middleware/entry';
import { WritePermissionVal } from '@fastgpt/global/support/permission/constant';
import { readFromSecondary } from '@fastgpt/service/common/mongo/utils';
import { parsePaginationRequest } from '@fastgpt/service/common/api/pagination';
import { PaginationResponse } from '@fastgpt/web/common/fetch/type';
import { addSourceMember } from '@fastgpt/service/support/user/utils';
import { replaceRegChars } from '@fastgpt/global/common/string/tools';

async function handler(
  req: NextApiRequest,
  _res: NextApiResponse
): Promise<PaginationResponse<AppLogsListItemType>> {
  const {
    appId,
    dateStart = addDays(new Date(), -7),
    dateEnd = new Date(),
    sources,
    logTitle
  } = req.body as GetAppChatLogsParams;

  const { pageSize = 20, offset } = parsePaginationRequest(req);

  if (!appId) {
    throw new Error('缺少参数');
  }

  // 凭证校验
  const { teamId } = await authApp({ req, authToken: true, appId, per: WritePermissionVal });

  const where = {
    teamId: new Types.ObjectId(teamId),
    appId: new Types.ObjectId(appId),
    updateTime: {
      $gte: new Date(dateStart),
      $lte: new Date(dateEnd)
    },
    ...(sources && { source: { $in: sources } }),
    ...(logTitle && {
      $or: [
        { title: { $regex: new RegExp(`${replaceRegChars(logTitle)}`, 'i') } },
        { customTitle: { $regex: new RegExp(`${replaceRegChars(logTitle)}`, 'i') } }
      ]
    })
  };

  const [list, total] = await Promise.all([
    MongoChat.aggregate(
      [
        { $match: where },
        {
          $sort: {
            userBadFeedbackCount: -1,
            userGoodFeedbackCount: -1,
            customFeedbacksCount: -1,
            updateTime: -1
          }
        },
        { $skip: offset },
        { $limit: pageSize },
        {
          $lookup: {
            from: ChatItemCollectionName,
            let: { chatId: '$chatId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$appId', new Types.ObjectId(appId)] },
                      { $eq: ['$chatId', '$$chatId'] }
                    ]
                  }
                }
              },
              {
                $project: {
                  userGoodFeedback: 1,
                  userBadFeedback: 1,
                  customFeedbacks: 1,
                  adminFeedback: 1
                }
              }
            ],
            as: 'chatitems'
          }
        },
        {
          $addFields: {
            userGoodFeedbackCount: {
              $size: {
                $filter: {
                  input: '$chatitems',
                  as: 'item',
                  cond: { $ifNull: ['$$item.userGoodFeedback', false] }
                }
              }
            },
            userBadFeedbackCount: {
              $size: {
                $filter: {
                  input: '$chatitems',
                  as: 'item',
                  cond: { $ifNull: ['$$item.userBadFeedback', false] }
                }
              }
            },
            customFeedbacksCount: {
              $size: {
                $filter: {
                  input: '$chatitems',
                  as: 'item',
                  cond: { $gt: [{ $size: { $ifNull: ['$$item.customFeedbacks', []] } }, 0] }
                }
              }
            },
            markCount: {
              $size: {
                $filter: {
                  input: '$chatitems',
                  as: 'item',
                  cond: { $ifNull: ['$$item.adminFeedback', false] }
                }
              }
            }
          }
        },
        {
          $project: {
            _id: 1,
            id: '$chatId',
            title: 1,
            customTitle: 1,
            source: 1,
            sourceName: 1,
            time: '$updateTime',
            messageCount: { $size: '$chatitems' },
            userGoodFeedbackCount: 1,
            userBadFeedbackCount: 1,
            customFeedbacksCount: 1,
            markCount: 1,
            outLinkUid: 1,
            tmbId: 1
          }
        }
      ],
      {
        ...readFromSecondary
      }
    ),
    MongoChat.countDocuments(where, { ...readFromSecondary })
  ]);

  const listWithSourceMember = await addSourceMember({
    list: list
  });

  const listWithoutTmbId = list.filter((item) => !item.tmbId);

  return {
    list: listWithSourceMember.concat(listWithoutTmbId),
    total
  };
}

export default NextAPI(handler);
