import { expect, test, describe } from 'bun:test';
import { createToken, validToken } from '../src/utils/tokenUtils';

/**
 * 类型守卫：检查是否为成功的 token 验证结果
 */
function isTokenValid(result: ReturnType<typeof validToken>): result is {
  status: 1;
  data?: any;
  _permission?: string[];
  _masTime?: number;
  [key: string]: any;
} {
  return result.status === 1;
}

describe('tokenUtils', () => {
  const defaultKey = '8087';
  const customKey = 'customKey123';

  describe('createToken', () => {
    test('应该创建基本的 token（只有 data）', () => {
      const data = { userId: 123, username: 'test' };
      const token = createToken({ data }, defaultKey);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    test('应该创建带过期时间的 token', () => {
      const data = { userId: 123 };
      const time = 3600; // 1小时
      const token = createToken({ data, time }, defaultKey);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // 验证 token 可以解密
      const result = validToken({ token }, defaultKey);
      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toEqual(data);
        expect(result._masTime).toBeGreaterThan(Date.now());
      }
    });

    test('应该创建带权限的 token', () => {
      const data = { userId: 123 };
      const permission = ['read', 'write'];
      const token = createToken({ data, permission }, defaultKey);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // 验证 token 包含权限
      const result = validToken({ token, permission: ['read'] }, defaultKey);
      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result._permission).toEqual(permission);
      }
    });

    test('应该创建带过期时间和权限的 token', () => {
      const data = { userId: 123 };
      const time = 3600;
      const permission = ['admin', 'user'];
      const token = createToken({ data, time, permission }, defaultKey);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // 验证 token 包含所有信息
      const result = validToken({ token, permission: ['admin'] }, defaultKey);
      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toEqual(data);
        expect(result._permission).toEqual(permission);
        expect(result._masTime).toBeGreaterThan(Date.now());
      }
    });

    test('应该使用自定义密钥创建 token', () => {
      const data = { userId: 123 };
      const token = createToken({ data }, customKey);

      expect(token).toBeDefined();

      // 使用相同密钥验证
      const result = validToken({ token }, customKey);
      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toEqual(data);
      }

      // 使用错误密钥应该失败
      const wrongResult = validToken({ token }, defaultKey);
      expect(wrongResult.status).toBe(0);
    });

    test('应该创建无过期时间的 token（time = 0）', () => {
      const data = { userId: 123 };
      const token = createToken({ data, time: 0 }, defaultKey);

      expect(token).toBeDefined();

      const result = validToken({ token }, defaultKey);
      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result._masTime).toBeUndefined();
      }
    });

    test('应该创建空 data 的 token', () => {
      const token = createToken({}, defaultKey);

      expect(token).toBeDefined();

      const result = validToken({ token }, defaultKey);
      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('validToken', () => {
    test('应该验证有效的 token（无权限要求）', () => {
      const data = { userId: 123 };
      const token = createToken({ data }, defaultKey);

      const result = validToken({ token }, defaultKey);

      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toEqual(data);
      }
    });

    test('应该验证有效的 token（有权限要求，且权限匹配）', () => {
      const data = { userId: 123 };
      const permission = ['read', 'write', 'delete'];
      const token = createToken({ data, permission }, defaultKey);

      // 测试匹配其中一个权限
      const result1 = validToken({ token, permission: ['read'] }, defaultKey);
      expect(result1.status).toBe(1);

      // 测试匹配多个权限
      const result2 = validToken(
        { token, permission: ['read', 'write'] },
        defaultKey
      );
      expect(result2.status).toBe(1);

      // 测试匹配所有权限
      const result3 = validToken(
        { token, permission: ['read', 'write', 'delete'] },
        defaultKey
      );
      expect(result3.status).toBe(1);
    });

    test('应该拒绝无效的 token（token 为空）', () => {
      const result = validToken({ token: null as any }, defaultKey);

      expect(result.status).toBe(0);
      expect(result.errorCode).toBe(0);
      expect(result.msg).toBe('没有传入token数据');
    });

    test('应该拒绝无效的 token（token 为 undefined）', () => {
      const result = validToken({ token: undefined as any }, defaultKey);

      expect(result.status).toBe(0);
      expect(result.errorCode).toBe(0);
      expect(result.msg).toBe('没有传入token数据');
    });

    test('应该拒绝无效的 token（token 解密失败）', () => {
      const invalidToken = 'invalid_token_string';

      const result = validToken({ token: invalidToken as any }, defaultKey);

      expect(result.status).toBe(0);
      expect(result.errorCode).toBe(1);
      expect(result.msg).toBe('token数据错误');
    });

    test('应该拒绝权限错误（token 没有权限字段）', () => {
      const data = { userId: 123 };
      const token = createToken({ data }, defaultKey);

      const result = validToken({ token, permission: ['read'] }, defaultKey);

      expect(result.status).toBe(0);
      expect(result.errorCode).toBe(2);
      expect(result.msg).toBe('权限错误');
    });

    test('应该拒绝权限错误（token 权限不匹配）', () => {
      const data = { userId: 123 };
      const permission = ['read', 'write'];
      const token = createToken({ data, permission }, defaultKey);

      const result = validToken({ token, permission: ['delete'] }, defaultKey);

      expect(result.status).toBe(0);
      expect(result.errorCode).toBe(2);
      expect(result.msg).toBe('权限错误');
    });

    test('应该拒绝过期的 token', () => {
      const data = { userId: 123 };
      // 创建已过期的 token（过期时间为 1 秒前）
      const time = -1; // 负数表示已过期
      const token = createToken({ data, time }, defaultKey);

      // 等待一下确保过期
      Bun.sleepSync(10);

      const result = validToken({ token }, defaultKey);

      expect(result.status).toBe(0);
      expect(result.errorCode).toBe(3);
      expect(result.msg).toBe('token过期');
    });

    test('应该验证未过期的 token', () => {
      const data = { userId: 123 };
      const time = 3600; // 1小时后过期
      const token = createToken({ data, time }, defaultKey);

      const result = validToken({ token }, defaultKey);

      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toEqual(data);
        expect(result._masTime).toBeGreaterThan(Date.now());
      }
    });

    test('应该使用自定义密钥验证 token', () => {
      const data = { userId: 123 };
      const token = createToken({ data }, customKey);

      const result = validToken({ token }, customKey);

      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toEqual(data);
      }
    });

    test('应该拒绝使用错误密钥验证的 token', () => {
      const data = { userId: 123 };
      const token = createToken({ data }, customKey);

      const result = validToken({ token }, defaultKey);

      expect(result.status).toBe(0);
      expect(result.errorCode).toBe(1);
      expect(result.msg).toBe('token数据错误');
    });

    test('应该验证无过期时间的 token（_masTime = 0）', () => {
      const data = { userId: 123 };
      const token = createToken({ data, time: 0 }, defaultKey);

      const result = validToken({ token }, defaultKey);

      expect(result.status).toBe(1);
      // 无过期时间的 token 不应该有 _masTime 字段，或者为 0
      if (isTokenValid(result)) {
        if (result._masTime !== undefined) {
          expect(result._masTime).toBe(0);
        }
      }
    });

    test('应该验证空权限数组（不进行权限检查）', () => {
      const data = { userId: 123 };
      const permission = ['read'];
      const token = createToken({ data, permission }, defaultKey);

      // 传入空权限数组，应该不进行权限检查
      const result = validToken({ token, permission: [] }, defaultKey);

      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toEqual(data);
      }
    });

    test('应该正确处理复杂数据对象', () => {
      const data = {
        userId: 123,
        username: 'test',
        roles: ['admin', 'user'],
        metadata: {
          created: '2024-01-01',
          active: true,
        },
      };
      const token = createToken({ data }, defaultKey);

      const result = validToken({ token }, defaultKey);

      expect(result.status).toBe(1);
      if (isTokenValid(result)) {
        expect(result.data).toEqual(data);
      }
    });
  });
});
