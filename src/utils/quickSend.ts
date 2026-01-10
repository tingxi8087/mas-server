import type { RequestHandler, Response } from 'express';

/**
 * 扩展 Response 对象，添加便捷的返回方法。
 * 为 Express 中间件，给 res 对象添加 return、reply、success、fail 方法。
 */
const quickSend: RequestHandler = (req, res, next) => {
  // req.fields && (req.body = req.fields);
  const resExt = res as Response & {
    return: (
      data: any,
      status?: number,
      code?: number,
      msg?: string
    ) => Promise<void>;

    reply: (
      data: any,
      status?: any,
      code?: number,
      msg?: string
    ) => Promise<void>;
    success: (data: any, msg?: string) => Promise<void>;
    fail: (data: any, msg?: string) => Promise<void>;
  };

  resExt.return = async (data, status = 1, code = 200, msg = '') => {
    if (data === null || data === undefined) {
      status = 0;
    }
    if (data instanceof Promise) data = await data;
    if (typeof data != 'string') {
      try {
        data = JSON.stringify(data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        console.error('响应序列化失败', req.method, req.url, data);
        data = '响应序列化失败';
      }
    }
    res.status(code).send({
      msg,
      status: status ? 1 : 0,
      data: data === null || data === undefined ? null : data,
    });
  };

  resExt.reply = async (data, status?: any, code = 200, msg = '') => {
    const finalStatus = status ?? (data ? 1 : 0);
    return await resExt.return(data, finalStatus, code, msg);
  };

  resExt.success = async (data, msg = '成功') => {
    return await resExt.return(data, 1, 200, msg);
  };

  resExt.fail = async (data, msg = '系统错误，请联系管理员') => {
    return await resExt.return(data, 0, 200, msg);
  };

  next();
};

export default quickSend;
