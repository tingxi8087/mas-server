import type { MasConfig, MasHandler } from '../../../src/type';

// 接口配置
export const config: MasConfig = {};
export const handler: MasHandler<typeof config> = async (req, res) => {
  res.reply('hello mas-server');
};
