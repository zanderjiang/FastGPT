import { SystemConfigsTypeEnum } from '@fastgpt/global/common/system/config/constants';
import { MongoSystemConfigs } from './schema';
import { FastGPTConfigFileType } from '@fastgpt/global/common/system/types';
import { FastGPTProUrl } from '../constants';

export const getFastGPTConfigFromDB = async () => {
  if (!FastGPTProUrl) {
    return {
      config: {} as FastGPTConfigFileType
    };
  }

  const res = await MongoSystemConfigs.findOne({
    type: SystemConfigsTypeEnum.fastgpt
  }).sort({
    createTime: -1
  });

  const config = res?.value || {};
  // 利用配置文件的创建时间（更新时间）来做缓存，如果前端命中缓存，则不需要再返回配置文件
  global.systemInitBufferId = res ? res.createTime.getTime().toString() : undefined;

  return {
    config: config as FastGPTConfigFileType
  };
};

export const updateFastGPTConfigBuffer = async () => {
  const res = await MongoSystemConfigs.findOne({
    type: SystemConfigsTypeEnum.fastgpt
  }).sort({
    createTime: -1
  });

  if (!res) return;

  res.createTime = new Date();
  await res.save();

  global.systemInitBufferId = res.createTime.getTime().toString();
};

export const reloadFastGPTConfigBuffer = async () => {
  const res = await MongoSystemConfigs.findOne({
    type: SystemConfigsTypeEnum.fastgpt
  }).sort({
    createTime: -1
  });
  if (!res) return;
  global.systemInitBufferId = res.createTime.getTime().toString();
};
