import type { Request, Response } from 'express';
import type {
  TypeFromValidFormat,
  TypeFromValidFormatForQuery,
  ValidFormat,
} from './utils/typeFromValidFormat';
/**
 * 请求类型
 */
export type MasReq<
  TRequestFormat = any,
  TMethod extends HttpMethod = HttpMethod,
> = Request<
  any,
  any,
  // GET：不再从 body 取参；非 GET：body 才参与校验/断言
  TMethod extends 'get' ? any : TypeFromValidFormat<TRequestFormat>,
  // GET：入参来自 query；非 GET：query 不做推导（保持 any）
  TMethod extends 'get' ? TypeFromValidFormatForQuery<TRequestFormat> : any
>;

/**
 * MAS 接口配置的最小结构（仅用于类型推导）。
 */
export type MasConfigLike = {
  requestFormat?: any;
  responseFormat?: any;
  methods?: HttpMethod;
};

/**
 * HTTP 方法类型。
 */
export type HttpMethod = 'get' | 'post' | 'all';

/**
 * GET 请求的 requestFormat 约束：
 * - query 只允许 string，因此这里只允许 `String`（必填）或 `_String`（可选）
 * - 明确不允许 Number / Boolean / Object / -1 / 数组 / 嵌套对象
 */
export type GetRequestFormat = Record<string, StringConstructor | '?'>;

/**
 * MAS 接口的完整配置类型。
 */
export type MasConfig<
  TRequestFormat extends ValidFormat | undefined = ValidFormat,
  TResponseFormat extends ValidFormat | undefined = ValidFormat,
  THeader extends Record<string, ValidFormat> | undefined = Record<
    string,
    ValidFormat
  >,
> =
  | {
      /** 接口名称 */
      name?: string;
      /** 是否严格模式（strict=true 时对象不允许出现多余字段） */
      strict?: boolean;
      /** HTTP 方法（非 GET） */
      methods?: Exclude<HttpMethod, 'get'>;
      /** Content-Type */
      contentType?: string;
      /** Header 参数格式（key 为参数名，value 为类型描述符） */
      header?: THeader;
      /** 请求体格式（非 GET：校验/断言 req.body） */
      requestFormat?: TRequestFormat;
      /** 响应体格式 */
      responseFormat?: TResponseFormat;
      /** 是否需要 token 验证 */
      token?: boolean;
      /** 权限列表 */
      permission?: string[];
    }
  | {
      /** 接口名称 */
      name?: string;
      /** 是否严格模式（strict=true 时对象不允许出现多余字段） */
      strict?: boolean;
      /** HTTP 方法（GET） */
      methods: 'get';
      /** Content-Type */
      contentType?: string;
      /** Header 参数格式（key 为参数名，value 为类型描述符） */
      header?: THeader;
      /**
       * GET：入参来自 req.query，只允许 string，因此 requestFormat 必须是扁平的 string 描述
       * （写 Number/数组/嵌套对象 会直接 TS 报错）
       */
      requestFormat?: TRequestFormat extends GetRequestFormat
        ? TRequestFormat
        : GetRequestFormat;
      /** 响应体格式 */
      responseFormat?: TResponseFormat;
      /** 是否需要 token 验证 */
      token?: boolean;
      /** 权限列表 */
      permission?: string[];
    };

/** 从配置中提取 requestFormat */
type ReqFormatOf<TConfig> = TConfig extends {
  requestFormat?: infer TRequestFormat;
}
  ? NonNullable<TRequestFormat>
  : any;

/** 从配置中提取 methods */
type MethodOf<TConfig> = TConfig extends { methods?: infer TMethods }
  ? NonNullable<TMethods> extends HttpMethod
    ? NonNullable<TMethods>
    : HttpMethod
  : HttpMethod;

/** 从配置中提取 responseFormat */
type ResFormatOf<TConfig> = TConfig extends {
  responseFormat?: infer TResponseFormat;
}
  ? NonNullable<TResponseFormat>
  : any;

/**
 * MAS 接口处理函数类型：入参 req/res 会根据 `config` 自动推导。
 *
 * 用法示例：
 * `export default (async (req, res) => { ... }) satisfies MasHandler<typeof config>;`
 */
export type MasHandler<TConfig extends MasConfigLike = MasConfigLike> = (
  req: MasReq<ReqFormatOf<TConfig>, MethodOf<TConfig>>,
  res: MasRes<ResFormatOf<TConfig>>
) => any;

/**
 * 响应类型
 */
export type MasRes<TResponseFormat = any> = Response<
  TypeFromValidFormat<TResponseFormat>
> & {
  /**
   * MAS 封装的统一返回方法。
   *
   * @param reply - 返回的数据体；可通过 `MasRes<typeof config.responseFormat>` 从 responseFormat 推导
   * @param status - 业务状态（沿用现有约定，保持 any）
   * @param code - 业务码
   * @param msg - 提示信息
   */
  reply: (
    data: TypeFromValidFormat<TResponseFormat>,
    status?: any,
    code?: number,
    msg?: string
  ) => void;
};

/**
 * API 文档中字段的描述信息。
 */
export type FieldDesc = {
  /** 字段名称 */
  name: string;
  /** 字段描述 */
  desc: string;
};

/**
 * API 文档中某个部分（header/request/response）的结构。
 */
export type SectionDoc = {
  /** 示例数据对象 */
  example: Record<string, any>;
  /** 字段描述数组 */
  desc: FieldDesc[];
};

/**
 * API 文档的完整结构。
 */
export type ApisDoc = {
  /** Header 部分的文档 */
  header?: SectionDoc;
  /** Request 部分的文档 */
  request?: SectionDoc;
  /** Response 部分的文档 */
  response?: SectionDoc;
};

export type MasAppConfig = {
  logs: {
    /** 是否记录日志 */
    open: boolean;
    /** 是否打印访问日志 */
    debug: boolean;
    /** 日志路径，默认 logs/ */
    logPath?: string;
    /**
     * 是否在 access log 中记录请求体（req.body）。默认开启
     */
    logRequestBody?: boolean;
    /**
     * 是否在 access log 中记录响应体（res.send/res.json）。默认开启
     */
    logResponseBody?: boolean;
    /**
     * body 最大记录长度（超过会截断），默认 2000。
     */
    maxBodyLength?: number;
    /**
     * 需要打码/移除的字段名（支持嵌套对象的 key 匹配），默认：[]。
     */
    redactKeys?: string[];
  };
  token: {
    /** 是否使用token */
    open: boolean;
    /** token密钥，密钥中只能包含大小写字母和数字 */
    pwd: string;
    /** 参数名 */
    headerParams: string;
  };
  /** 接口路径，默认src/apis 或 apis/ */
  apisPath?: string;
  /** 兜底接口文件路径，不传默认返回404 */
  defalutApiPath?: string;
  /** 项目名称，默认mas-app */
  projectName?: string;
  /** 是否允许跨域，默认 false */
  openCors?: boolean;
  /** 跨域允许的地址 */
  corsUrl?: string[];
  /** 静态文件目录路径，默认 public/ */
  staticPath?: string;
  /** 静态资源访问路径前缀，默认 /public */
  staticUrl?: string;
  /** 是否暴露接口文档信息（/debug/docs），默认 true */
  exposeApiDocs?: boolean;
};
