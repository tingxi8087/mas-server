import { describe, expect, test } from 'bun:test';
import type express from 'express';
import { createApiHandler } from '../src/getApp/apiHandler';

describe('createApiHandler - GET query 校验', () => {
  test('GET：校验/断言来源为 req.query（req.body 不参与）', async () => {
    let called = false;
    const mod = {
      config: {
        methods: 'get' as const,
        strict: true,
        requestFormat: { name: String },
      },
      handler: async (req: any, res: any) => {
        called = true;
        // 这里只验证链路会放行；类型推导在 TS 层体现（不在运行时测试）
        expect(req.query.name).toBe('tingxi');
        res.reply({ ok: true });
      },
    };

    const req = {
      method: 'GET',
      headers: {},
      query: { name: 'tingxi' },
      body: { name: 123 }, // 即便 body 不合法，也不应影响 GET
    } as unknown as express.Request;

    const replyCalls: any[] = [];
    const res = {
      reply: (...args: any[]) => replyCalls.push(args),
    } as unknown as express.Response;

    const appConfig = {
      logs: { open: false, debug: false },
      token: { open: false, pwd: 'x', headerParams: 'token' },
    } as any;

    const handler = createApiHandler('/x/get.ts', mod as any, appConfig);
    await handler(req, res, () => {});

    expect(called).toBe(true);
    expect(replyCalls.length).toBe(1);
  });

  test('GET：query 出现对象/嵌套结构时应拒绝（只允许 string/string[]）', async () => {
    const mod = {
      config: {
        methods: 'get' as const,
        strict: false,
        requestFormat: { name: String },
      },
      handler: async (_req: any, _res: any) => {
        throw new Error('should not be called');
      },
    };

    const req = {
      method: 'GET',
      headers: {},
      query: { name: { a: 'b' } },
      body: {},
    } as unknown as express.Request;

    const replyCalls: any[] = [];
    const res = {
      reply: (...args: any[]) => replyCalls.push(args),
    } as unknown as express.Response;

    const appConfig = {
      logs: { open: false, debug: false },
      token: { open: false, pwd: 'x', headerParams: 'token' },
    } as any;

    const handler = createApiHandler('/x/get.ts', mod as any, appConfig);
    await handler(req, res, () => {});

    expect(replyCalls.length).toBe(1);
    expect(replyCalls[0][2]).toBe(400);
  });

  test('GET：query 出现数组时应拒绝（只允许 string，不允许 string[]）', async () => {
    const mod = {
      config: {
        methods: 'get' as const,
        strict: false,
        requestFormat: { name: String },
      },
      handler: async (_req: any, _res: any) => {
        throw new Error('should not be called');
      },
    };

    const req = {
      method: 'GET',
      headers: {},
      query: { name: ['a', 'b'] },
      body: {},
    } as unknown as express.Request;

    const replyCalls: any[] = [];
    const res = {
      reply: (...args: any[]) => replyCalls.push(args),
    } as unknown as express.Response;

    const appConfig = {
      logs: { open: false, debug: false },
      token: { open: false, pwd: 'x', headerParams: 'token' },
    } as any;

    const handler = createApiHandler('/x/get.ts', mod as any, appConfig);
    await handler(req, res, () => {});

    expect(replyCalls.length).toBe(1);
    expect(replyCalls[0][2]).toBe(400);
  });

  test('GET：requestFormat 含 Number/-1 等非 string 类型时应报接口配置错误', async () => {
    const mod = {
      config: {
        methods: 'get' as const,
        strict: false,
        requestFormat: { age: Number },
      },
      handler: async (_req: any, _res: any) => {
        throw new Error('should not be called');
      },
    };

    const req = {
      method: 'GET',
      headers: {},
      query: { age: '18' },
      body: {},
    } as unknown as express.Request;

    const replyCalls: any[] = [];
    const res = {
      reply: (...args: any[]) => replyCalls.push(args),
    } as unknown as express.Response;

    const appConfig = {
      logs: { open: false, debug: false },
      token: { open: false, pwd: 'x', headerParams: 'token' },
    } as any;

    const handler = createApiHandler('/x/get.ts', mod as any, appConfig);
    await handler(req, res, () => {});

    expect(replyCalls.length).toBe(1);
    expect(replyCalls[0][2]).toBe(500);
  });

  test('GET：requestFormat 含数组格式时应报接口配置错误', async () => {
    const mod = {
      config: {
        methods: 'get' as const,
        strict: false,
        requestFormat: { tags: [String] },
      },
      handler: async (_req: any, _res: any) => {
        throw new Error('should not be called');
      },
    };

    const req = {
      method: 'GET',
      headers: {},
      query: { tags: 'a' },
      body: {},
    } as unknown as express.Request;

    const replyCalls: any[] = [];
    const res = {
      reply: (...args: any[]) => replyCalls.push(args),
    } as unknown as express.Response;

    const appConfig = {
      logs: { open: false, debug: false },
      token: { open: false, pwd: 'x', headerParams: 'token' },
    } as any;

    const handler = createApiHandler('/x/get.ts', mod as any, appConfig);
    await handler(req, res, () => {});

    expect(replyCalls.length).toBe(1);
    expect(replyCalls[0][2]).toBe(500);
  });
});
