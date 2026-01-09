import type { Express } from 'express';
import type { MasAppConfig, MasConfig } from '../type';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import quickSend from '../utils/quickSend';
import { defaultConfig, mergeAppConfig, resolveApisPaths } from './config';
import { toRoutePath, walkApiFilesSync } from './fsRoutes';
import { createApiHandler, type LoadedApiModule } from './apiHandler';
import { buildApiDocForDebug, serializeMasConfigForDoc } from './docTransform';
import attachLogs, { attachConsoleLogs } from './logs';
import { openCors } from '../middleware/openCors';

/**
 * 创建 MAS Express 应用并挂载约定式路由。
 *
 * @param dirname - 项目根目录（默认会在其中探测 `src/apis` 或 `apis`）
 * @param config - 应用配置（会与默认配置合并）
 * @param beforeMounted - 在框架挂载中间件/路由前的回调（可用于注册自定义中间件）
 */
export async function getApp(
  dirname: string,
  config?: MasAppConfig,
  beforeMounted?: (_app: Express) => void
) {
  const app = express();
  beforeMounted && beforeMounted(app);
  // 自动探测默认路径 + 合并配置
  const detected = resolveApisPaths(dirname);
  defaultConfig.logs!.logPath = path.join(dirname, 'logs');
  defaultConfig.apisPath = detected.apisPath;
  defaultConfig.defalutApiPath = detected.defalutApiPath;
  const finalConfig = mergeAppConfig(defaultConfig, config);

  // CORS 配置
  if (finalConfig.openCors) {
    openCors(app, finalConfig.corsUrl);
  }

  // body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 静态文件目录
  const staticPath = finalConfig.staticPath ?? 'public';
  const staticUrl = finalConfig.staticUrl ?? '/public';
  const fullStaticPath = path.isAbsolute(staticPath)
    ? staticPath
    : path.join(dirname, staticPath);
  if (fs.existsSync(fullStaticPath)) {
    app.use(staticUrl, express.static(fullStaticPath));
  }

  // quick reply
  app.use(quickSend);

  // debug log（控制台）：直接打印 morgan 那一行
  if (finalConfig?.logs?.debug) {
    attachConsoleLogs(app, {
      logRequestBody: finalConfig?.logs?.logRequestBody,
      logResponseBody: finalConfig?.logs?.logResponseBody,
      maxBodyLength: finalConfig?.logs?.maxBodyLength,
      redactKeys: finalConfig?.logs?.redactKeys,
    });
  }

  // access log（落盘）
  if (finalConfig?.logs?.open && finalConfig?.logs?.logPath) {
    attachLogs(app, finalConfig.logs.logPath, {
      logRequestBody: finalConfig.logs.logRequestBody,
      logResponseBody: finalConfig.logs.logResponseBody,
      maxBodyLength: finalConfig.logs.maxBodyLength,
      redactKeys: finalConfig.logs.redactKeys,
    });
  }

  // 路由挂载
  const apisRoot = finalConfig.apisPath!;
  const files = walkApiFilesSync(apisRoot);
  const defaultApiPath = finalConfig.defalutApiPath;

  const loaded: Array<{
    path: string;
    apiPath: string;
    file: string;
    mod: LoadedApiModule;
  }> = [];

  // 启动时一次性加载所有 API 模块（不做懒加载）
  // 若模块加载失败/缺少 handler，会直接抛错，确保启动阶段暴露问题。
  for (const file of files) {
    const routePath = toRoutePath(apisRoot, file);
    const apiRoutePath = `/api${routePath}`;
    const mod = (await import(pathToFileURL(file).href)) as LoadedApiModule;
    const handler = (mod as any).handler;
    if (typeof handler !== 'function') {
      throw new Error(`API 模块缺少导出 handler：${file}`);
    }
    loaded.push({ path: routePath, apiPath: apiRoutePath, file, mod });
    app.all(apiRoutePath, createApiHandler(file, mod, finalConfig));
  }

  // 文档聚合：GET `/debug/docs`（可通过配置控制是否暴露）
  if (finalConfig.exposeApiDocs === true) {
    app.get(`/debug/docs`, async (req, res) => {
      const list: Array<{
        path: string;
        file: string;
        config?: any;
        doc?: any;
      }> = [];

      for (const item of loaded) {
        const rawConfig = (item.mod as any).config as MasConfig | undefined;
        const rawDoc = (item.mod as any).doc;
        list.push({
          path: item.apiPath,
          file: item.file,
          config: serializeMasConfigForDoc(rawConfig),
          doc: buildApiDocForDebug(rawConfig, rawDoc),
        });
      }

      (res as any).reply?.(list);
    });
  }

  // 兜底：如果存在 defalutApiPath，则在 404 时调用它
  if (defaultApiPath && fs.existsSync(defaultApiPath)) {
    // Express 5（path-to-regexp v6）不支持 `'*'` 这种 path 写法；
    // 这里放在所有路由之后，直接 app.use 即可兜底未命中的请求。
    const fallbackMod = (await import(
      pathToFileURL(defaultApiPath).href
    )) as LoadedApiModule;
    const handler = (fallbackMod as any).handler;
    if (typeof handler !== 'function') {
      throw new Error(`兜底 API 模块缺少导出 handler：${defaultApiPath}`);
    }
    app.use(createApiHandler(defaultApiPath, fallbackMod, finalConfig));
  } else {
    app.use((req, res) => {
      (res as any).reply?.(null, 0, 404, 'Not Found');
    });
  }

  // error handler
  app.use((err: any, req: any, res: any, _next: any) => {
    const msg = err?.message ? String(err.message) : '系统错误，请联系管理员';
    if (typeof res?.reply === 'function') return res.reply(null, 0, 500, msg);
    return res.status(500).send({ status: 0, msg, data: null });
  });

  return app;
}
