import type { Express } from 'express';
import fs from 'node:fs';
import moment from 'moment';
import morgan from 'morgan';
import { createStream } from 'rotating-file-stream';

export type AccessLogOptions = {
  /** 是否记录请求体 */
  logRequestBody?: boolean;
  /** 是否记录响应体 */
  logResponseBody?: boolean;
  /** body 最大记录长度，默认 2000 */
  maxBodyLength?: number;
  /** 需要打码/移除的字段名，默认 ['password','pwd','token'] */
  redactKeys?: string[];
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function redact(value: unknown, redactKeys: string[]): unknown {
  if (!value) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, redactKeys));
  if (!isPlainObject(value)) return value;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (redactKeys.includes(k)) out[k] = '[REDACTED]';
    else out[k] = redact(v, redactKeys);
  }
  return out;
}

function safeStringify(
  value: unknown,
  maxLen: number,
  redactKeys: string[]
): string {
  try {
    if (value === undefined) return '-';
    if (value === null) return 'null';
    const redacted = redact(value, redactKeys);
    let s: string;
    if (typeof redacted === 'string') s = redacted;
    else {
      const json = JSON.stringify(redacted);
      s = json === undefined ? '-' : json;
    }
    if (s.length > maxLen) s = `${s.slice(0, maxLen)}...(truncated)`;
    return s;
  } catch {
    return '[Unserializable]';
  }
}

function attachBodyCapture(
  app: Express,
  options: Required<
    Pick<
      AccessLogOptions,
      'logRequestBody' | 'logResponseBody' | 'maxBodyLength' | 'redactKeys'
    >
  >
) {
  if (!options.logRequestBody && !options.logResponseBody) return;

  // 避免重复挂载（同时落盘 + 控制台打印会调用两次）
  const appAny = app as any;
  if (appAny.__masBodyCaptureAttached) return;
  appAny.__masBodyCaptureAttached = true;

  app.use((req, res, next) => {
    if (options.logRequestBody) {
      (res.locals as any).__masReqBody = req.body;
    }

    if (!options.logResponseBody) return next();

    const resAny = res as any;
    const originalSend = resAny.send?.bind(resAny);
    const originalJson = resAny.json?.bind(resAny);

    if (typeof originalSend === 'function') {
      resAny.send = (body: any) => {
        (res.locals as any).__masResBody = body;
        return originalSend(body);
      };
    }

    if (typeof originalJson === 'function') {
      resAny.json = (body: any) => {
        (res.locals as any).__masResBody = body;
        return originalJson(body);
      };
    }

    next();
  });
}

function createMorganMiddleware(
  finalOptions: Required<
    Pick<
      AccessLogOptions,
      'logRequestBody' | 'logResponseBody' | 'maxBodyLength' | 'redactKeys'
    >
  >,
  stream: { write: (str: string) => void }
) {
  // 时间用 moment（上海时区等价于 utcOffset(+8)）
  morgan.token('date', () =>
    moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
  );

  // 可选追加 req/res body
  morgan.token('req-body', (req, res) => {
    if (!finalOptions.logRequestBody) return '-';
    return safeStringify(
      (res as any).locals?.__masReqBody,
      finalOptions.maxBodyLength,
      finalOptions.redactKeys
    );
  });
  morgan.token('res-body', (req, res) => {
    if (!finalOptions.logResponseBody) return '-';
    return safeStringify(
      (res as any).locals?.__masResBody,
      finalOptions.maxBodyLength,
      finalOptions.redactKeys
    );
  });

  // 保留 combined 的原始字段（不能丢），并把 req/res 追加到同一行
  const combinedWithBody =
    ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" req=:req-body res=:res-body';
  const combined =
    ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

  return morgan(
    finalOptions.logRequestBody || finalOptions.logResponseBody
      ? combinedWithBody
      : combined,
    { stream }
  );
}

/**
 * 控制台打印访问日志（打印 morgan 那一行）。
 *
 * @param app - express app
 * @param options - 额外配置（是否记录入参/出参等）
 */
export function attachConsoleLogs(
  app: Express,
  options: AccessLogOptions = {}
) {
  const finalOptions = {
    logRequestBody: options.logRequestBody ?? true,
    logResponseBody: options.logResponseBody ?? true,
    maxBodyLength: options.maxBodyLength ?? 2000,
    redactKeys: options.redactKeys ?? [],
  };

  attachBodyCapture(app, finalOptions);
  app.use(
    createMorganMiddleware(finalOptions, {
      write: (str) => process.stdout.write(str),
    })
  );
}

/**
 * 挂载 access log（落盘），实现与 `.backup/src/utils/logs.ts` 一致的策略：
 * - morgan combined
 * - rotating-file-stream：按天滚动 + 单文件 50MB
 *
 * @param app - express app
 * @param dir - 日志目录
 * @param options - 额外配置（是否记录入参/出参等）
 */
export default function attachLogs(
  app: Express,
  dir: string,
  options: AccessLogOptions = {}
) {
  fs.mkdirSync(dir, { recursive: true });

  const finalOptions = {
    // 你要求“记录入参和出参”，这里默认开启；如需关闭可显式传 false
    logRequestBody: options.logRequestBody ?? true,
    logResponseBody: options.logResponseBody ?? true,
    maxBodyLength: options.maxBodyLength ?? 2000,
    redactKeys: options.redactKeys ?? [],
  };

  attachBodyCapture(app, finalOptions);

  const accessLogStream = createStream('access.log', {
    size: '50M',
    interval: '1d',
    path: dir,
  });
  app.use(createMorganMiddleware(finalOptions, accessLogStream));
}
