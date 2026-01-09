import type { MasAppConfig } from '../type';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 默认应用配置（会在 getApp 内根据 dirname 补全路径字段）。
 */
export const defaultConfig: MasAppConfig = {
  logs: {
    open: true,
    debug: true,
  },
  token: {
    open: true,
    pwd: '8087',
    headerParams: 'token',
  },
  projectName: 'mas-app',
  openCors: false,
  corsUrl: [],
};

/**
 * 深度合并 `MasAppConfig`（仅处理一层嵌套的 `logs/token`，避免浅合并误覆盖）。
 *
 * @param base - 默认配置
 * @param override - 用户配置
 */
export function mergeAppConfig(
  base: MasAppConfig,
  override?: MasAppConfig
): MasAppConfig {
  if (!override) return { ...base };
  return {
    ...base,
    ...override,
    logs: { ...base?.logs, ...override?.logs },
    token: { ...base?.token, ...override?.token },
  };
}

/**
 * 根据传入的 dirname 自动探测 apis 目录（兼容 `src/apis` 与 `apis` 两种结构）。
 *
 * @param dirname - 项目根目录
 */
export function resolveApisPaths(dirname: string): {
  apisPath: string;
  defalutApiPath: string;
} {
  const candidates = [
    {
      apisPath: path.join(dirname, 'src/apis'),
      defalutApiPath: '',
    },
    {
      apisPath: path.join(dirname, 'apis'),
      defalutApiPath: '',
    },
  ];

  for (const c of candidates) {
    if (fs.existsSync(c.apisPath)) return c;
  }

  // 兜底：保持原约定（src/apis）
  return candidates[0]!;
}
