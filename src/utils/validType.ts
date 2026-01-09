import type { ValidFormat } from './typeFromValidFormat';

/**
 * 获取值的“运行时类型标签”（与 `Object.prototype.toString` 一致）。
 *
 * @param value - 任意值
 * @returns 小写类型字符串，例如：`"string" | "number" | "object" | "array" | "function"`
 */
export function getType(value: unknown): string {
  return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
}

/** 仅用于读取构造器名称的最小类型（避免使用 `Function`）。 */
type NamedDescriptor = { name: string };

/**
 * 是否为“可选字段占位符”格式：
 * - `'?'` -> 可选 string
 * - `-1` -> 可选 number
 */
function isOptionalDescriptor(format: unknown): format is '?' | -1 {
  return format === '?' || format === -1;
}

/**
 * 校验可选占位符：
 * - 缺失/undefined/null：通过
 * - 存在：按占位符对应的基础类型校验
 */
function validOptional(value: unknown, format: '?' | -1): boolean {
  if (value === null || value === undefined) return true;
  if (format === '?') return getType(value) === 'string';
  // format === -1
  return getType(value) === 'number';
}

/**
 * 是否为“可选数组字段”格式：
 * - `[_String]` -> 字段可选，存在时必须是非空 string[]
 * - `[_Number]` -> 字段可选，存在时必须是非空 number[]
 */
function isOptionalArrayFieldFormat(format: unknown): format is ('?' | -1)[] {
  return (
    Array.isArray(format) &&
    format.length > 0 &&
    (format[0] === '?' || format[0] === -1)
  );
}

/**
 * 校验可选数组字段：
 * - 缺失/undefined/null：通过
 * - 存在：必须是非空数组，且元素类型为 string/number
 */
function validOptionalArrayField(value: unknown, element: '?' | -1): boolean {
  if (value === null || value === undefined) return true;
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;

  for (const item of value) {
    if (element === '?') {
      if (getType(item) !== 'string') return false;
    } else {
      if (getType(item) !== 'number') return false;
    }
  }

  return true;
}

/**
 * 校验基础类型（由构造器描述符定义）。
 *
 * @param value - 待校验值
 * @param descriptor - `String/Number/Boolean/Object` 等构造器（仅使用其 name）
 */
function validBaseType(value: unknown, descriptor: NamedDescriptor): boolean {
  // descriptor.name: "String" | "Number" | "Boolean" | "Object" ...
  return getType(value) === descriptor.name.toLowerCase();
}

/**
 * 校验对象：非 strict 只要求格式中的 key 必须存在且通过校验；strict 要求 key 集合完全一致。
 */
function validObject(
  value: unknown,
  format: Record<string, ValidFormat>,
  strict: boolean
): boolean {
  if (getType(value) !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  // strict：不允许多余字段
  if (strict) {
    for (const key of Object.keys(obj)) {
      if (!(key in format)) return false;
    }
  }

  // 两种模式都要求：格式内字段必须存在且类型正确
  for (const key of Object.keys(format)) {
    const v = obj[key];
    const childFormat = format[key];
    if (!childFormat) return false;

    // 可选数组字段：`[_String] / [_Number]`
    if (isOptionalArrayFieldFormat(childFormat)) {
      const element = childFormat[0] as '?' | -1;
      if (!validOptionalArrayField(v, element)) return false;
      continue;
    }

    // 可选字段：允许缺失/undefined/null；存在时校验对应基础类型
    if (isOptionalDescriptor(childFormat)) {
      if (!validOptional(v, childFormat)) return false;
      continue;
    }

    // 必填字段：不允许缺失
    if (v === null || v === undefined) return false;
    if (!validType(v, childFormat, strict)) return false;
  }

  return true;
}

/**
 * 校验数组：要求 value 为数组，且非空；数组每个元素都要匹配数组元素格式。
 */
function validArray(
  value: unknown,
  format: ValidFormat[],
  strict: boolean
): boolean {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;

  const elementFormat = format[0];
  if (!elementFormat) {
    throw new Error(
      `非法的校验格式：数组格式不能为空（示例：[String] / [{...}]）`
    );
  }

  for (const item of value) {
    if (!validType(item, elementFormat, strict)) return false;
  }

  return true;
}

/**
 * 校验值是否满足 `typeMapping/requestFormat` 所描述的格式。
 *
 * @param value - 待校验值（通常是 req.body 或其子字段）
 * @param format - 格式描述（`String/Number/...`、对象、数组）
 * @param strict - strict=true 时对象不允许出现多余字段；strict=false 允许多余字段
 */
export default function validType(
  value: unknown,
  format: ValidFormat,
  strict: boolean = false
): boolean {
  // 可选占位符：自身即可处理 undefined/null
  if (isOptionalDescriptor(format)) return validOptional(value, format);
  if (value === null || value === undefined) return false;

  const formatType = getType(format);

  if (formatType === 'function') {
    return validBaseType(value, format as unknown as NamedDescriptor);
  }

  if (Array.isArray(format)) {
    return validArray(value, format, strict);
  }

  if (formatType === 'object') {
    return validObject(value, format as Record<string, ValidFormat>, strict);
  }

  // 未知格式：为了安全，默认校验失败（也便于尽早发现 format 写错）
  return false;
}
