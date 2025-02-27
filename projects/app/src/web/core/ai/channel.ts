import axios, { Method, AxiosResponse } from 'axios';
import { getWebReqUrl } from '@fastgpt/web/common/system/utils';
import {
  ChannelInfoType,
  ChannelListResponseType,
  ChannelLogListItemType,
  CreateChannelProps
} from '@/global/aiproxy/type';
import { ChannelStatusEnum } from '@/global/aiproxy/constants';

interface ResponseDataType {
  success: boolean;
  message: string;
  data: any;
}

/**
 * 请求成功,检查请求头
 */
function responseSuccess(response: AxiosResponse<ResponseDataType>) {
  return response;
}
/**
 * 响应数据检查
 */
function checkRes(data: ResponseDataType) {
  if (data === undefined) {
    console.log('error->', data, 'data is empty');
    return Promise.reject('服务器异常');
  } else if (!data.success) {
    return Promise.reject(data);
  }
  return data.data;
}

/**
 * 响应错误
 */
function responseError(err: any) {
  console.log('error->', '请求错误', err);
  const data = err?.response?.data || err;

  if (!err) {
    return Promise.reject({ message: '未知错误' });
  }
  if (typeof err === 'string') {
    return Promise.reject({ message: err });
  }
  if (typeof data === 'string') {
    return Promise.reject(data);
  }

  return Promise.reject(data);
}

/* 创建请求实例 */
const instance = axios.create({
  timeout: 60000, // 超时时间
  headers: {
    'content-type': 'application/json'
  }
});

/* 响应拦截 */
instance.interceptors.response.use(responseSuccess, (err) => Promise.reject(err));

function request(url: string, data: any, method: Method): any {
  /* 去空 */
  for (const key in data) {
    if (data[key] === undefined) {
      delete data[key];
    }
  }

  return instance
    .request({
      baseURL: getWebReqUrl('/api/aiproxy/api'),
      url,
      method,
      data: ['POST', 'PUT'].includes(method) ? data : undefined,
      params: !['POST', 'PUT'].includes(method) ? data : undefined
    })
    .then((res) => checkRes(res.data))
    .catch((err) => responseError(err));
}

/**
 * api请求方式
 * @param {String} url
 * @param {Any} params
 * @param {Object} config
 * @returns
 */
export function GET<T = undefined>(url: string, params = {}): Promise<T> {
  return request(url, params, 'GET');
}
export function POST<T = undefined>(url: string, data = {}): Promise<T> {
  return request(url, data, 'POST');
}
export function PUT<T = undefined>(url: string, data = {}): Promise<T> {
  return request(url, data, 'PUT');
}
export function DELETE<T = undefined>(url: string, data = {}): Promise<T> {
  return request(url, data, 'DELETE');
}

// ====== API ======
export const getChannelList = () =>
  GET<ChannelListResponseType>('/channels/all', {
    page: 1,
    perPage: 10
  });

export const getChannelProviders = () =>
  GET<
    Record<
      number,
      {
        defaultBaseUrl: string;
        keyHelp: string;
        name: string;
      }
    >
  >('/channels/type_metas');

export const postCreateChannel = (data: CreateChannelProps) =>
  POST(`/createChannel`, {
    type: data.type,
    name: data.name,
    base_url: data.base_url,
    models: data.models,
    model_mapping: data.model_mapping,
    key: data.key
  });

export const putChannelStatus = (id: number, status: ChannelStatusEnum) =>
  POST(`/channel/${id}/status`, {
    status
  });
export const putChannel = (data: ChannelInfoType) =>
  PUT(`/channel/${data.id}`, {
    type: data.type,
    name: data.name,
    base_url: data.base_url,
    models: data.models,
    model_mapping: data.model_mapping,
    key: data.key,
    status: data.status,
    priority: data.priority
  });

export const deleteChannel = (id: number) => DELETE(`/channel/${id}`);

export const getChannelLog = (params: {
  channel?: string;
  model_name?: string;
  status?: 'all' | 'success' | 'error';
  start_timestamp: number;
  end_timestamp: number;
  offset: number;
  pageSize: number;
}) =>
  GET<{
    logs: ChannelLogListItemType[];
    total: number;
  }>(`/logs/search`, {
    ...params,
    p: Math.floor(params.offset / params.pageSize) + 1,
    per_page: params.pageSize,
    offset: undefined,
    pageSize: undefined
  }).then((res) => {
    return {
      list: res.logs,
      total: res.total
    };
  });

export const getLogDetail = (id: number) =>
  GET<{
    request_body: string;
    response_body: string;
  }>(`/logs/detail/${id}`);
