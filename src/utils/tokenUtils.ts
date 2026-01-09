import { decode as _decode, encode as _encode } from './mas-encrypt.min.js';

const getTimestamp = () => new Date().getTime();

/**
 * 解码加密的 token 字符串
 * @param token - 需要解码的加密 token 字符串
 * @param key - 解密密钥，默认为 '8087'
 * @param layer - 编码层数，默认为 0
 * @returns 解码后的数据对象，如果解码失败则返回 false
 */
function decode(token: string, key: string = '8087', layer: number = 0): any {
  return _decode(token, key, layer);
}

/**
 * 编码数据为加密的 token 字符串
 * @param data - 需要编码的数据，可以是对象或字符串
 * @param key - 加密密钥，默认为 '8087'
 * @param layer - 编码层数，默认为 0
 * @returns 编码后的 token 字符串
 */
function encode(data: any, key: string = '8087', layer: number = 0): string {
  return _encode(data, key, layer);
}

/**
 * Token 验证结果类型
 */
type TokenValidationResult =
  | {
      status: 1;
      data?: any;
      _permission?: string[];
      _masTime?: number;
      [key: string]: any;
    }
  | {
      status: 0;
      msg: string;
      errorCode: number;
      token?: any;
    };

/**
 * 验证 token
 * @param param0 token:解密的token,permission:效验的权限，只要有其中一个就可
 * @param key 解密密钥
 * @returns 验证结果
 */
const validToken = (
  { token, permission = [] }: { token: any; permission?: string[] },
  key = '8087'
): TokenValidationResult => {
  if (!token)
    return { msg: '没有传入token数据', errorCode: 0, status: 0, token };
  const decodedToken = decode(token, key);
  if (!decodedToken)
    return { msg: 'token数据错误', errorCode: 1, status: 0, token };
  // 鉴权
  if (permission.length != 0) {
    const tPermission = decodedToken._permission;
    if (!tPermission) {
      return { msg: '权限错误', errorCode: 2, status: 0, token };
    }
    if (
      tPermission?.filter((value: string) => permission.includes(value))
        .length == 0
    ) {
      return { msg: '权限错误', errorCode: 2, status: 0, token };
    }
  }
  // 过期时间
  if (decodedToken._masTime !== 0) {
    if (getTimestamp() > decodedToken._masTime)
      return { msg: 'token过期', errorCode: 3, status: 0, token };
  }

  return { ...decodedToken, status: 1 };
};

/**
 * 创建 token
 * @param param0 data:加密的数据,time:过期时间/s(为零则不会过期),permission:权限设置
 * @param key 加密密钥
 * @returns 加密后的 token 字符串
 */
function createToken(
  {
    data = null,
    time = 0,
    permission = [],
  }: { data?: any; time?: number; permission?: string[] } = {},
  key = '8087'
): string {
  const token: any = {};
  token.data = data;
  permission.length != 0 && (token._permission = permission);
  time !== 0 && (token._masTime = time * 1000 + getTimestamp());
  return encode(token, key);
}

export { validToken, createToken, decode, encode };
