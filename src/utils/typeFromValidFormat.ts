/**
 * 由 `requestFormat`（运行时校验格式）推导出真实的 TypeScript 类型。
 *
 * 约定（与 `src/utils/validType.ts` 的运行时校验保持一致）：
 * - `String / Number / Boolean / Object` 这类构造器表示基础类型
 * - `'?'` 表示 **可选 string**（字段可缺失/可为 undefined/null；存在时必须是 string）
 * - `-1` 表示 **可选 number**（字段可缺失/可为 undefined/null；存在时必须是 number）
 * - `[...]` 表示数组，数组元素格式由数组元素类型决定（推荐只放 1 个元素作为“模板”）
 * - `{ ... }` 表示对象，key 对应字段格式
 */

/** 运行时校验支持的基础构造器描述符 */
export type BasicTypeDescriptor =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor;

/**
 * 可选字段占位符（仅用于 `requestFormat/responseFormat` 的“值”层表达）。
 *
 * 使用示例：
 * ```ts
 * const _String = '?' as const;
 * const _Number = -1 as const;
 * const requestFormat = { name: _String, age: _Number };
 * ```
 */
export type OptionalDescriptor = '?' | -1;

/**
 * 运行时校验格式（requestFormat）的 TypeScript 结构。
 *
 * 注意：这里是“类型层”定义，用于推导 **req.body 或 req.query** 的类型；运行时仍由 `validType` 校验。
 */
export type ValidFormat =
  | BasicTypeDescriptor
  | OptionalDescriptor
  | { [key: string]: ValidFormat }
  | ValidFormat[];

/** 可选字符串占位符：字段可缺失/undefined/null；存在时必须是 string */
export const _String = '?' as const;
/** 可选数字占位符：字段可缺失/undefined/null；存在时必须是 number */
export const _Number = -1 as const;

/**
 * 将构造器描述符映射为对应的 TypeScript 原始类型。
 */
type PrimitiveFromDescriptor<T> = T extends StringConstructor
  ? string
  : T extends NumberConstructor
    ? number
    : T extends BooleanConstructor
      ? boolean
      : T extends ObjectConstructor
        ? Record<string, unknown>
        : never;

/**
 * 将可选占位符映射为对应的 TypeScript 原始类型（存在时的类型）。
 */
type PrimitiveFromOptionalDescriptor<T> = T extends '?'
  ? string
  : T extends -1
    ? number
    : never;

/**
 * 从对象格式中计算“可选字段 key 集合”。
 */
type OptionalKeys<T> = T extends object
  ? {
      [K in keyof T]-?: T[K] extends OptionalDescriptor
        ? K
        : // 兼容 `[_String] / [_Number]`：表示“可选数组字段”（字段可缺失，但存在时是数组）
          T[K] extends readonly (infer U)[]
          ? U extends OptionalDescriptor
            ? K
            : never
          : never;
    }[keyof T]
  : never;

/**
 * 从对象格式中计算“必填字段 key 集合”。
 */
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>;

/**
 * 从 `requestFormat` 推导 body 类型：
 * - 构造器 -> 基础类型
 * - 可选占位符 -> 基础类型（存在时）
 * - 数组 -> 元素类型数组
 * - 对象 -> 递归映射字段
 * - 其它 -> unknown
 */
export type TypeFromValidFormat<T> = T extends BasicTypeDescriptor
  ? PrimitiveFromDescriptor<T>
  : T extends OptionalDescriptor
    ? PrimitiveFromOptionalDescriptor<T>
    : T extends readonly (infer U)[]
      ? TypeFromValidFormat<U>[]
      : T extends object
        ? // 对象字段：占位符字段推导为可选属性，其余字段为必填属性
          { [K in RequiredKeys<T>]: TypeFromValidFormat<T[K]> } & {
            [K in OptionalKeys<T>]?: TypeFromValidFormat<T[K]>;
          }
        : unknown;

/**
 * 面向 GET `req.query` 的推导版本：
 * - GET 约束 query 仅允许 string（以及 string[]），因此 Number/Boolean/Object/-1 会推导为 never
 * - 这能让“GET 写了 Number requestFormat”在 TS 层直接报错
 */
type QueryPrimitiveFromDescriptor<T> = T extends StringConstructor
  ? string
  : T extends NumberConstructor | BooleanConstructor | ObjectConstructor
    ? never
    : never;

type QueryPrimitiveFromOptionalDescriptor<T> = T extends '?'
  ? string
  : T extends -1
    ? never
    : never;

export type TypeFromValidFormatForQuery<T> = T extends BasicTypeDescriptor
  ? QueryPrimitiveFromDescriptor<T>
  : T extends OptionalDescriptor
    ? QueryPrimitiveFromOptionalDescriptor<T>
    : T extends readonly (infer _U)[]
      ? // GET：requestFormat 不允许数组；若绕过约束，此处也推导为 never 以尽早暴露问题
        never
      : T extends object
        ? { [K in RequiredKeys<T>]: TypeFromValidFormatForQuery<T[K]> } & {
            [K in OptionalKeys<T>]?: TypeFromValidFormatForQuery<T[K]>;
          }
        : unknown;
