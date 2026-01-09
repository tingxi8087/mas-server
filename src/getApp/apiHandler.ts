import type {
  GetRequestFormat,
  MasAppConfig,
  MasConfig,
  MasHandler,
} from '../type';
import express from 'express';
import validType from '../utils/validType';
import { validToken } from '../utils/tokenUtils';
import type { ValidFormat } from '../utils/typeFromValidFormat';

export type LoadedApiModule = {
  config?: MasConfig;
  handler?: MasHandler<any>;
  doc?: any;
};

/**
 * GET 请求的 query 值类型（Express 运行时可能是 string / string[] / object）。
 */
type GetQueryValue = string | string[] | Record<string, unknown> | undefined;

/**
 * 判断当前请求是否为 GET（以实际请求 method 为准）。
 *
 * @param req - express req
 */
function isGetRequest(req: express.Request): boolean {
  return String(req.method).toUpperCase() === 'GET';
}

/**
 * GET 请求只允许接收 string 参数：校验 query 中的值必须是 string 或 string[]（且数组元素也必须是 string）。
 *
 * @param value - query 的任意字段值
 */
function isGetQueryStringValue(value: unknown): value is string {
  // 约束：GET query 只允许 string（不允许 string[]）
  return typeof value === 'string';
}

/**
 * 将 `req.query` 规范化为可用于 `validType` 的纯对象：
 * - 仅接受 string/string[]
 * - 其它类型（object/number/boolean 等）直接判定为非法
 *
 * @param query - express req.query
 */
export function normalizeGetQuery(
  query: unknown
): { ok: true; value: Record<string, string> } | { ok: false } {
  if (!query || typeof query !== 'object' || Array.isArray(query))
    return { ok: false };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(query as Record<string, GetQueryValue>)) {
    if (v === undefined || v === null) continue;
    if (!isGetQueryStringValue(v)) return { ok: false };
    out[k] = v;
  }
  return { ok: true, value: out };
}

/**
 * 判断 GET 请求的 requestFormat 是否满足约束：
 * - 必须是扁平对象：`Record<string, String | '?'>`
 * - 不允许数组/嵌套对象/Number/Boolean/Object/-1
 *
 * @param format - requestFormat
 */
export function isGetOnlyStringFormat(
  format: unknown
): format is GetRequestFormat {
  if (!format || typeof format !== 'object' || Array.isArray(format))
    return false;
  for (const v of Object.values(format as Record<string, unknown>)) {
    if (!(v === String || v === '?')) return false;
  }
  return true;
}

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
          if (!validType(normalized, format, false)) {
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
      if (appConfig?.token?.open && cfg?.token) {
        const tokenKey = appConfig?.token?.headerParams || '';
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
        if (isGetRequest(req)) {
          // GET：校验/断言来源为 req.query，且只允许 string 参数
          if (!isGetOnlyStringFormat(cfg.requestFormat)) {
            return (res as any).reply?.(
              null,
              0,
              500,
              '接口配置错误：GET 的 requestFormat 仅支持扁平的 String/_String（不支持 Number/数组/嵌套对象）'
            );
          }
          const normalized = normalizeGetQuery(req.query);
          if (!normalized.ok) {
            return (res as any).reply?.(
              null,
              0,
              400,
              'GET 请求参数仅支持 string 类型（不支持数组/对象/嵌套结构）'
            );
          }
          const ok = validType(
            normalized.value,
            cfg.requestFormat as ValidFormat,
            !!cfg.strict
          );
          if (!ok)
            return (res as any).reply?.(null, 0, 400, '请求参数格式错误');
        } else {
          // 非 GET：保持原逻辑，校验/断言 req.body
          const ok = validType(
            req.body,
            cfg.requestFormat as ValidFormat,
            !!cfg.strict
          );
          if (!ok)
            return (res as any).reply?.(null, 0, 400, '请求参数格式错误');
        }
      }

      return await (handler as any)(req, res);
    } catch (err) {
      return next(err);
    }
  };
}
