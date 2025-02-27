import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { getUploadModel } from '@fastgpt/service/common/file/multer';
import { removeFilesByPaths } from '@fastgpt/service/common/file/utils';
import fs from 'fs';
import { pushWhisperUsage } from '@/service/support/wallet/usage/push';
import { authChatCrud } from '@/service/support/permission/auth/chat';
import { OutLinkChatAuthProps } from '@fastgpt/global/support/permission/chat';
import { NextAPI } from '@/service/middleware/entry';
import { aiTranscriptions } from '@fastgpt/service/core/ai/audio/transcriptions';
import { useIPFrequencyLimit } from '@fastgpt/service/common/middle/reqFrequencyLimit';
import { getDefaultSTTModel } from '@fastgpt/service/core/ai/model';

const upload = getUploadModel({
  maxSize: 5
});

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  let filePaths: string[] = [];

  try {
    let {
      file,
      data: { appId, duration, shareId, outLinkUid, teamId: spaceTeamId, teamToken }
    } = await upload.doUpload<
      OutLinkChatAuthProps & {
        appId: string;
        duration: number;
      }
    >(req, res);

    req.body.appId = appId;
    req.body.shareId = shareId;
    req.body.outLinkUid = outLinkUid;
    req.body.teamId = spaceTeamId;
    req.body.teamToken = teamToken;

    filePaths = [file.path];

    if (!getDefaultSTTModel()) {
      throw new Error('whisper model not found');
    }

    if (!file) {
      throw new Error('file not found');
    }
    if (duration === undefined) {
      throw new Error('duration not found');
    }
    duration = duration < 1 ? 1 : duration;

    // auth role
    const { teamId, tmbId } = await authChatCrud({
      req,
      authToken: true,
      ...req.body
    });

    // auth app
    // const app = await MongoApp.findById(appId, 'modules').lean();
    // if (!app) {
    //   throw new Error('app not found');
    // }
    // if (!whisperConfig?.open) {
    //   throw new Error('Whisper is not open in the app');
    // }

    const result = await aiTranscriptions({
      model: getDefaultSTTModel().model,
      fileStream: fs.createReadStream(file.path)
    });

    pushWhisperUsage({
      teamId,
      tmbId,
      duration
    });

    jsonRes(res, {
      data: result.text
    });
  } catch (err) {
    console.log(err);
    jsonRes(res, {
      code: 500,
      error: err
    });
  }

  removeFilesByPaths(filePaths);
}

export default NextAPI(
  useIPFrequencyLimit({ id: 'transcriptions', seconds: 1, limit: 1 }),
  handler
);

export const config = {
  api: {
    bodyParser: false
  }
};
