import type { MasConfig, MasHandler } from '../../../src/type';
import apisDoc from '../apisDoc/test';
export const doc = apisDoc;
// 请求格式
const requestFormat = {
  name: String,
  age: Number,
  strArray: [String],
  grade: {
    chinese: Number,
    math: Number,
    english: Number,
  },
};
// 响应格式
const responseFormat = {
  name: String,
  age: Number,
};
const header = {
  testParam: String,
};
// 接口配置
export const config: MasConfig<
  typeof requestFormat,
  typeof responseFormat,
  typeof header
> = {
  name: '测试接口',
  strict: false,
  methods: 'post',
  contentType: 'application/json',
  header,
  requestFormat,
  responseFormat,
  token: true,
  permission: ['test'],
};
export const handler: MasHandler<typeof config> = async (req, res) => {
  console.log(req.body);
  res.reply({ name: req.body.name, age: req.body.age });
};
