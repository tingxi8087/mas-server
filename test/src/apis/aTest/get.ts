import {
  type MasConfig,
  type MasHandler,
  _Number,
  _String,
} from '../../../../src';
const requestFormat = {
  name: String,
  age: Number,
};
const responseFormat = {
  test: [String],
};

// 接口配置
export const config: MasConfig<typeof requestFormat, typeof responseFormat> = {
  responseFormat,
  requestFormat,
  strict: true,
  methods: 'get',
};
export const handler: MasHandler<typeof config> = async (req, res) => {
  console.log(req.query);
  res.reply({ test: [''] });
};
