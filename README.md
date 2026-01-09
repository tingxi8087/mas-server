# mas-server

一行代码，实现约定式路由，自带常用业务功能，开箱即用，让你的express飞起来

## ✨ 特性

- 🚀 **约定式路由** - 自动扫描 API 文件，根据文件路径生成路由
- 🔒 **权限管理** - 基于 JWT Token 的权限验证系统
- 📝 **类型安全** - 通过 `requestFormat` 和 `responseFormat` 实现类型推导和运行时校验
- 📊 **日志管理** - 支持访问日志（控制台和文件），可记录请求/响应体
- 🎯 **统一响应格式** - 提供 `res.reply()` 等便捷方法
- 🌐 **CORS 支持** - 可配置的跨域支持
- 📁 **静态文件服务** - 支持静态文件目录
- 📖 **API 文档** - 自动生成 API 文档（通过 `/debug/docs` 访问）

## 📦 安装

```bash
npm install mas-server
# 或
bun add mas-server
```

## 🚀 快速开始

### 1. 编写 API

创建 `src/apis/user/login.ts`：

```typescript
import type { MasConfig, MasHandler } from 'mas-server';

export const config: MasConfig = {
  requestFormat: { username: String, password: String },
  responseFormat: { token: String },
};

export const handler: MasHandler<typeof config> = async (req, res) => {
  res.reply({ token: 'xxx' });
};
```

### 2. 启动服务

创建 `main.ts`：

```typescript
import { getApp } from 'mas-server';
import { fileURLToPath } from 'url';
import path from 'path';

(await getApp(path.dirname(fileURLToPath(import.meta.url)))).listen(8087);
```

运行：

```bash
bun run main.ts
```

就这么简单！访问 `http://localhost:8087/api/user/login` 即可。

## 📚 核心功能

### 约定式路由

框架会自动扫描 `src/apis` 或 `apis` 目录下的 `.ts`/`.js` 文件，根据文件路径生成路由：

- `src/apis/index.ts` → `/api/`
- `src/apis/user/index.ts` → `/api/user`
- `src/apis/user/login.ts` → `/api/user/login`
- `src/apis/user/profile.ts` → `/api/user/profile`

所有路由都会自动添加 `/api` 前缀。

### 类型安全

通过 `requestFormat` 和 `responseFormat` 定义请求和响应的数据结构，框架会：

1. **类型推导** - 自动推导 `req.body` 和 `res.reply()` 的类型
2. **运行时校验** - 自动校验请求参数格式，不符合格式的请求会返回 400 错误

#### 支持的类型

- **基础类型**：`String`、`Number`、`Boolean`、`Object`
- **可选字段**：
  - `_String` - 可选字符串（`'?'`）
  - `_Number` - 可选数字（`-1`）
- **数组**：`[String]`、`[Number]`、`[{...}]`
- **嵌套对象**：`{ key: String, nested: { ... } }`

#### 示例

```typescript
const requestFormat = {
  name: String, // 必填字符串
  age: _Number, // 可选数字
  email: _String, // 可选字符串
  tags: [String], // 字符串数组
  address: {
    // 嵌套对象
    city: String,
    zipCode: _String,
  },
};

const config: MasConfig<typeof requestFormat> = {
  requestFormat,
  strict: false, // strict=true 时不允许多余字段
};
```

### Token 验证

框架提供了完整的 JWT Token 系统：

#### 创建 Token

```typescript
import { createToken } from 'mas-server';

const token = createToken(
  {
    data: { userId: 123, username: 'admin' },
    time: 3600, // 过期时间（秒），0 表示永不过期
    permission: ['admin', 'user'], // 权限列表
  },
  'your-secret-key'
);
```

#### 验证 Token

在接口配置中启用 token 验证：

```typescript
export const config: MasConfig = {
  token: true, // 启用 token 验证
  permission: ['admin'], // 需要的权限（只要有一个即可）
};
```

Token 可以通过以下方式传递：

- Header: `token: xxx`
- Query: `?token=xxx`
- Body: `{ token: 'xxx' }`

#### 在接口中获取 Token 数据

```typescript
export const handler: MasHandler = async (req, res) => {
  const tokenData = (req as any).tokenData;
  // tokenData.data 包含创建 token 时传入的 data
  // tokenData._permission 包含权限列表
  // tokenData._masTime 包含过期时间戳
};
```

### 统一响应格式

框架提供了 `res.reply()` 方法，统一返回格式：

```typescript
// 成功响应
res.reply(data, 1, 200, '操作成功');

// 失败响应
res.reply(null, 0, 400, '参数错误');

// 简化写法（自动判断 status）
res.reply(data); // data 存在时 status=1，否则 status=0
```

响应格式：

```json
{
  "status": 1,
  "code": 200,
  "msg": "操作成功",
  "data": { ... }
}
```

### 日志管理

框架支持两种日志：

1. **控制台日志** - 开发时使用，实时打印访问日志
2. **文件日志** - 生产环境使用，按天滚动，单文件最大 50MB

#### 配置示例

```typescript
const app = await getApp(__dirname, {
  logs: {
    open: true, // 是否开启文件日志
    debug: true, // 是否开启控制台日志
    logPath: './logs', // 日志文件目录
    logRequestBody: true, // 是否记录请求体
    logResponseBody: true, // 是否记录响应体
    maxBodyLength: 2000, // body 最大记录长度
    redactKeys: ['password', 'token'], // 需要打码的字段
  },
});
```

### CORS 配置

```typescript
const app = await getApp(__dirname, {
  openCors: true,
  corsUrl: [
    'http://localhost:3000',
    'https://example.com',
    '*.example.com', // 支持通配符
  ],
});
```

### 静态文件服务

```typescript
const app = await getApp(__dirname, {
  staticPath: './public', // 静态文件目录
  staticUrl: '/public', // 访问路径前缀
});
```

访问：`http://localhost:8087/public/file.txt`

### API 文档

框架会自动生成 API 文档，访问 `/debug/docs` 即可查看所有接口的配置和文档信息。

可以通过配置开启：

```typescript
const app = await getApp(__dirname, {
  exposeApiDocs: true, // 开启 API 文档
});
```

### 接口配置选项

```typescript
export const config: MasConfig = {
  name: '接口名称',              // 接口名称（用于文档）
  methods: 'post',               // HTTP 方法：'get' | 'post' | 'all'
  contentType: 'application/json', // Content-Type 校验
  strict: false,                 // 严格模式（不允许多余字段）
  header: {                      // Header 参数校验
    'X-Custom-Header': String,
  },
  requestFormat: { ... },        // 请求体格式
  responseFormat: { ... },       // 响应体格式
  token: true,                   // 是否需要 token
  permission: ['admin'],         // 需要的权限
};
```

### 兜底接口

可以配置一个默认接口，当所有路由都不匹配时调用：

```typescript
const app = await getApp(__dirname, {
  defalutApiPath: path.join(__dirname, 'src/apis/fallback.ts'),
});
```

如果不配置，404 请求会返回：

```json
{
  "status": 0,
  "code": 404,
  "msg": "Not Found",
  "data": null
}
```

## 🔧 完整配置选项

```typescript
interface MasAppConfig {
  // 日志配置
  logs: {
    open: boolean; // 是否记录日志
    debug: boolean; // 是否打印访问日志
    logPath?: string; // 日志路径，默认 logs/
    logRequestBody?: boolean; // 是否记录请求体，默认 true
    logResponseBody?: boolean; // 是否记录响应体，默认 true
    maxBodyLength?: number; // body 最大记录长度，默认 2000
    redactKeys?: string[]; // 需要打码的字段名，默认 []
  };

  // Token 配置
  token: {
    open: boolean; // 是否使用 token
    pwd: string; // token 密钥
    headerParams: string; // 参数名，默认 'token'
  };

  // 路径配置
  apisPath?: string; // 接口路径，默认 src/apis 或 apis/
  defalutApiPath?: string; // 兜底接口文件路径

  // 其他配置
  projectName?: string; // 项目名称，默认 'mas-app'
  openCors?: boolean; // 是否允许跨域，默认 false
  corsUrl?: string[]; // 跨域允许的地址
  staticPath?: string; // 静态文件目录路径，默认 public/
  staticUrl?: string; // 静态资源访问路径前缀，默认 /public
  exposeApiDocs?: boolean; // 是否暴露接口文档，默认 false
}
```

## 📖 更多示例

### 带 Header 校验的接口

```typescript
const header = {
  'X-API-Key': String,
  'X-Version': Number,
};

export const config: MasConfig<
  typeof requestFormat,
  typeof responseFormat,
  typeof header
> = {
  header,
  // ...
};

export const handler: MasHandler<typeof config> = async (req, res) => {
  // Header 已自动校验，可以直接使用
  const apiKey = req.headers['x-api-key'];
  // ...
};
```

### API 文档示例

创建 `src/apisDoc/user/login.ts`：

```typescript
import type { ApisDoc } from 'mas-server';

export default {
  header: {
    example: { token: 'xxx' },
    desc: [{ name: 'token', desc: '用户 token' }],
  },
  request: {
    example: {
      username: 'admin',
      password: '123456',
    },
    desc: [
      { name: 'username', desc: '用户名' },
      { name: 'password', desc: '密码' },
    ],
  },
  response: {
    example: {
      token: 'xxx',
      userId: 123,
    },
    desc: [
      { name: 'token', desc: '登录 token' },
      { name: 'userId', desc: '用户 ID' },
    ],
  },
} satisfies ApisDoc;
```

在接口文件中引入：

```typescript
import doc from '../apisDoc/user/login';

export const doc = doc;
```

## 🛠️ 开发

```bash
# 构建
bun run build

# 开发模式（监听文件变化）
bun run testServer

# 调试
bun run debug
```

## 📄 License

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
