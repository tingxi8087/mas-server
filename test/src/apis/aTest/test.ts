import {
  type MasConfig,
  type MasHandler,
  _Number,
  _String,
} from '../../../../src';
const requestFormat = {
  name: String,
  age: _Number,
  test: [_String],
};
const responseFormat = {
  test: [String],
};

// 接口配置
export const config: MasConfig<typeof requestFormat, typeof responseFormat> = {
  responseFormat,
  requestFormat,
  strict: true,
};
export const handler: MasHandler<typeof config> = async (req, res) => {
  console.log(req.body.test);
  res.reply({ test: [''] });
};
