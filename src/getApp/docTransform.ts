import type { MasConfig } from '../type';
import type { ValidFormat } from '../utils/typeFromValidFormat';

type AnyRecord = Record<string, any>;

/**
 * 将 ValidFormat（包含构造器/函数）转换成可 JSON 序列化的结构：
 * - String/Number/... -> "String" / "Number" ...
 * - { a: String } -> { a: "String" }
 * - [String] -> ["String"]
 *
 * @param format - ValidFormat
 */
export function serializeValidFormat(format: unknown): any {
  if (!format) return format;
  // 可选字段占位符：用于 docs 展示（避免直接暴露 '?' / -1）
  if (format === '?') return 'String?';
  if (format === -1) return 'Number?';
  if (typeof format === 'function') return (format as any).name ?? 'Function';
  if (Array.isArray(format)) {
    // 约定：数组格式只看第 0 个元素作为模板
    // `[_String] / [_Number]`：代表“可选数组字段”，元素类型仍是 String/Number（不是元素可选）
    if (format[0] === '?') return ['String'] as any;
    if (format[0] === -1) return ['Number'] as any;
    return [serializeValidFormat(format[0])];
  }
  if (typeof format === 'object') {
    const out: AnyRecord = {};
    for (const [k, v] of Object.entries(format as AnyRecord)) {
      out[k] = serializeValidFormat(v);
    }
    return out;
  }
  return format;
}

function isPlainObject(value: unknown): value is AnyRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function exampleFromFormat(format: unknown): any {
  if (!format) return null;

  // 可选字段：示例仍给出“存在时”的典型值
  if (format === '?') return 'string';
  if (format === -1) return 0;

  if (typeof format === 'function') {
    const name = (format as any).name;
    if (name === 'String') return 'string';
    if (name === 'Number') return 0;
    if (name === 'Boolean') return true;
    if (name === 'Object') return {};
    return null;
  }

  if (Array.isArray(format)) {
    // `[_String] / [_Number]`：代表“可选数组字段”，示例给出存在时的数组
    if (format[0] === '?') return ['string'];
    if (format[0] === -1) return [0];
    return [exampleFromFormat(format[0])];
  }

  if (isPlainObject(format)) {
    const out: AnyRecord = {};
    for (const [k, v] of Object.entries(format)) {
      out[k] = exampleFromFormat(v);
    }
    return out;
  }

  return null;
}

type DescItem = { name: string; desc: string; type?: any };

function flattenDescFromFormat(format: unknown, prefix = ''): DescItem[] {
  if (!format) return [];

  // 叶子：可选字段占位符
  if (format === '?' || format === -1) {
    return [
      {
        name: prefix || 'value',
        desc: '',
        type: serializeValidFormat(format),
      },
    ];
  }

  // 叶子：函数/数组
  if (typeof format === 'function') {
    return [
      {
        name: prefix || 'value',
        desc: '',
        type: serializeValidFormat(format),
      },
    ];
  }

  if (Array.isArray(format)) {
    return [
      {
        name: prefix || 'value',
        desc: '',
        type: serializeValidFormat(format),
      },
    ];
  }

  if (isPlainObject(format)) {
    const out: DescItem[] = [];
    for (const [k, v] of Object.entries(format)) {
      const next = prefix ? `${prefix}.${k}` : k;
      out.push(...flattenDescFromFormat(v, next));
    }
    return out;
  }

  return [];
}

function getFormatByPath(format: unknown, namePath: string): unknown {
  if (!format) return undefined;
  if (!namePath) return undefined;

  // 支持 "a.b.c" 的点路径（主要用于 request/response 的嵌套字段）
  const parts = namePath.split('.').filter(Boolean);
  let cur: any = format;
  for (const p of parts) {
    if (!cur) return undefined;
    if (Array.isArray(cur)) {
      // 数组无法按 key 继续向下取，直接返回数组模板
      return cur;
    }
    if (typeof cur === 'function') return cur;
    if (!isPlainObject(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

type SectionDocView = {
  example: AnyRecord;
  desc: DescItem[];
};

function buildSectionDocView(
  section: any,
  format: unknown
): SectionDocView | undefined {
  if (!section && !format) return undefined;

  const example =
    section?.example ??
    (isPlainObject(format) ? (exampleFromFormat(format) as AnyRecord) : null);

  const normalizedExample: AnyRecord = isPlainObject(example)
    ? example
    : { value: exampleFromFormat(format) };

  const descFromUser: DescItem[] = Array.isArray(section?.desc)
    ? section.desc
    : [];
  const desc =
    descFromUser.length > 0 ? descFromUser : flattenDescFromFormat(format);

  const filledDesc = desc.map((d) => {
    const existedType = (d as any).type;
    if (existedType) return d;

    const inferred = getFormatByPath(format, d.name);
    if (inferred) {
      return { ...d, type: serializeValidFormat(inferred) };
    }

    // 参考旧实现：没有类型则默认 String
    return { ...d, type: 'String' };
  });

  return {
    example: normalizedExample,
    desc: filledDesc,
  };
}

/**
 * 生成 debug docs 用的 config 视图（把 requestFormat/responseFormat/header 转成可 JSON 序列化结构）。
 *
 * @param config - API config
 */
export function serializeMasConfigForDoc(config: MasConfig | undefined): any {
  if (!config) return config;
  return {
    ...config,
    header: config.header ? serializeValidFormat(config.header) : config.header,
    requestFormat: config.requestFormat
      ? serializeValidFormat(config.requestFormat as ValidFormat)
      : config.requestFormat,
    responseFormat: config.responseFormat
      ? serializeValidFormat(config.responseFormat as ValidFormat)
      : config.responseFormat,
  };
}

/**
 * 生成 debug docs 用的 doc 视图：
 * - 若用户提供 doc，则补齐 desc.type（从格式里推导）
 * - 若没提供 doc，则从格式生成 example + desc
 *
 * @param config - API config
 * @param doc - API doc（模块导出）
 */
export function buildApiDocForDebug(config: MasConfig | undefined, doc: any) {
  return {
    header: buildSectionDocView(doc?.header, config?.header),
    request: buildSectionDocView(doc?.request, config?.requestFormat),
    response: buildSectionDocView(doc?.response, config?.responseFormat),
  };
}
