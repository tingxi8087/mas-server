import type { Express, Request, Response, NextFunction } from 'express';

/**
 * 检查 origin 是否在允许列表中（支持通配符匹配）。
 *
 * @param origin - 请求的 origin
 * @param allowedUrls - 允许的地址列表
 */
function isOriginAllowed(
  origin: string | undefined,
  allowedUrls?: string[]
): boolean {
  if (!origin) return false;
  if (!allowedUrls || allowedUrls.length === 0) return true; // 未配置则允许所有

  return allowedUrls.some((url) => {
    // 精确匹配
    if (url === origin) return true;
    // 通配符匹配：支持 `*.example.com` 或 `http://*.example.com`
    if (url.includes('*')) {
      const pattern = url.replace(/\*/g, '.*').replace(/\./g, '\\.');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    return false;
  });
}

/**
 * 开放 CORS 中间件：支持配置允许的跨域地址列表。
 *
 * @param app - Express 应用实例
 * @param corsUrl - 允许的跨域地址列表（为空或未配置则允许所有）
 */
export function openCors(app: Express, corsUrl?: string[]) {
  const store: { allowHeader: string[] } = { allowHeader: [] };

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const requestedHeaders = req.headers['access-control-request-headers'];

    // 动态收集请求的 headers（去重）
    if (requestedHeaders) {
      const headers = requestedHeaders
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      store.allowHeader = [...new Set([...store.allowHeader, ...headers])];
    }

    // 检查 origin 是否在允许列表中
    if (origin && isOriginAllowed(origin, corsUrl)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin && corsUrl && corsUrl.length > 0) {
      // 如果配置了 corsUrl 但 origin 不在列表中，不设置 Allow-Origin（拒绝跨域）
      // 继续执行后续逻辑，但浏览器会阻止跨域请求
    } else if (!corsUrl || corsUrl.length === 0) {
      // 未配置 corsUrl，允许所有 origin（向后兼容）
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }

    res.setHeader(
      'Access-Control-Allow-Headers',
      store.allowHeader.length > 0 ? store.allowHeader.join(', ') : '*'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'PUT, POST, GET, DELETE, OPTIONS, PATCH'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // OPTIONS 预检请求直接返回 204
    if (req.method === 'OPTIONS') {
      return res.status(204).send();
    }

    next();
  });
}
