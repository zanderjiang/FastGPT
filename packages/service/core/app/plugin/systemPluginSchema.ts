import { connectionMongo, getMongoModel } from '../../../common/mongo/index';
const { Schema } = connectionMongo;
import type { SystemPluginConfigSchemaType } from './type';

export const collectionName = 'app_system_plugins';

const SystemPluginSchema = new Schema({
  pluginId: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean
  },
  inputConfig: {
    type: Array,
    default: []
  },
  originCost: {
    type: Number,
    default: 0
  },
  currentCost: {
    type: Number,
    default: 0
  },
  hasTokenFee: {
    type: Boolean,
    default: false
  },
  pluginOrder: {
    type: Number,
    default: 0
  },
  customConfig: Object
});

SystemPluginSchema.index({ pluginId: 1 });

export const MongoSystemPlugin = getMongoModel<SystemPluginConfigSchemaType>(
  collectionName,
  SystemPluginSchema
);
