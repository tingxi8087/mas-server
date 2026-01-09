import type { MasAppConfig, MasConfig, MasHandler } from '../type';
import express from 'express';
import validType from '../utils/validType';
import { validToken } from '../utils/tokenUtils';

export type LoadedApiModule = {
  config?: MasConfig;
  handler?: MasHandler<any>;
  doc?: any;
};

/**
 * 根据已加载的 API 模块创建路由处理器，并在调用前做：
 * - method 校验
 * - content-type 校验（仅在配置了 `contentType` 且存在 body 时）
 * - header 校验
 * - token 校验 + permission 校验
 * - requestFormat 校验
 *
 * @param filePath - API 文件路径（仅用于错误信息）
 * @param mod - 已加载的 API 模块
 * @param appConfig - 应用配置（用于 token 相关逻辑）
 */
export function createApiHandler(
  filePath: string,
  mod: LoadedApiModule,
  appConfig: MasAppConfig
): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const cfg = (mod as any).config as MasConfig | undefined;
      const handler = (mod as any).handler as MasHandler<any> | undefined;

      if (!handler) {
        return (res as any).reply?.(
          null,
          0,
          500,
          `API 模块缺少导出 handler：${filePath}`
        );
      }

      // methods 校验（默认 all）
      const methods = cfg?.methods ?? 'all';
      if (methods !== 'all' && req.method.toLowerCase() !== methods) {
        return (res as any).reply?.(null, 0, 405, 'Method Not Allowed');
      }

      // content-type 校验：仅在用户配置了 contentType 且请求带 body 时校验
      if (cfg?.contentType) {
        const hasBody =
          req.method.toUpperCase() !== 'GET' &&
          req.headers['content-length'] !== undefined;
        if (hasBody) {
          const ct = req.headers['content-type'] ?? '';
          if (!String(ct).includes(cfg.contentType)) {
            return (res as any).reply?.(null, 0, 400, 'Content-Type 不匹配');
          }
        }
      }

      // header 校验
      if (cfg?.header) {
        for (const [key, format] of Object.entries(cfg.header)) {
          const raw = req.headers[key.toLowerCase()];
          let value: any;
          if (Array.isArray(raw)) value = raw[0];
          else value = raw;
          if (value === undefined || value === null) {
            return (res as any).reply?.(null, 0, 400, `缺少 Header：${key}`);
          }

          // header 天然是 string：这里做最小转换（Number/Boolean 兼容常见传法）
          let normalized: any = value;
          if (format === Number) normalized = Number(value);
          if (format === Boolean)
            normalized = value === 'true' || value === '1' || value === 'yes';
          if (!validType(normalized, format as any, false)) {
            return (res as any).reply?.(
              null,
              0,
              400,
              `Header 类型错误：${key}`
            );
          }
        }
      }

      // token 校验（全局开关 + 单接口开关）
      if (appConfig.token.open && cfg?.token) {
        const tokenKey = appConfig.token.headerParams;
        const token =
          (req.headers[tokenKey.toLowerCase()] as any) ??
          (req.query as any)?.[tokenKey] ??
          (req.body as any)?.[tokenKey];
        const result = validToken(
          { token, permission: cfg.permission ?? [] },
          appConfig.token.pwd
        );
        if (result.status === 0) {
          return (res as any).reply?.(null, 0, 401, result.msg);
        }
        (req as any).tokenData = result;
      }

      // requestFormat 校验
      if (cfg?.requestFormat) {
        const ok = validType(req.body, cfg.requestFormat as any, !!cfg.strict);
        if (!ok) {
          return (res as any).reply?.(null, 0, 400, '请求参数格式错误');
        }
      }

      return await (handler as any)(req, res);
    } catch (err) {
      return next(err);
    }
  };
}
