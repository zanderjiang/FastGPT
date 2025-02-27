import { getSystemPluginCb } from '@/service/core/app/plugin';
import { initSystemConfig } from '.';
import { createDatasetTrainingMongoWatch } from '@/service/core/dataset/training/utils';
import { MongoSystemConfigs } from '@fastgpt/service/common/system/config/schema';
import { MongoSystemPlugin } from '@fastgpt/service/core/app/plugin/systemPluginSchema';
import { debounce } from 'lodash';
import { MongoAppTemplate } from '@fastgpt/service/core/app/templates/templateSchema';
import { getAppTemplatesAndLoadThem } from '@fastgpt/templates/register';
import { watchSystemModelUpdate } from '@fastgpt/service/core/ai/config/utils';

export const startMongoWatch = async () => {
  reloadConfigWatch();
  refetchSystemPlugins();
  createDatasetTrainingMongoWatch();
  refetchAppTemplates();
  watchSystemModelUpdate();
};

const reloadConfigWatch = () => {
  const changeStream = MongoSystemConfigs.watch();

  changeStream.on('change', async (change) => {
    try {
      if (change.operationType === 'insert') {
        await initSystemConfig();
        console.log('refresh system config');
      }
    } catch (error) {}
  });
};

const refetchSystemPlugins = () => {
  const changeStream = MongoSystemPlugin.watch();

  changeStream.on(
    'change',
    debounce(async (change) => {
      setTimeout(() => {
        try {
          getSystemPluginCb(true);
        } catch (error) {}
      }, 5000);
    }, 500)
  );
};

const refetchAppTemplates = () => {
  const changeStream = MongoAppTemplate.watch();

  changeStream.on(
    'change',
    debounce(async (change) => {
      setTimeout(() => {
        try {
          getAppTemplatesAndLoadThem(true);
        } catch (error) {}
      }, 5000);
    }, 500)
  );
};
