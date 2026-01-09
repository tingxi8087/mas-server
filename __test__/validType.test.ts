import { describe, expect, test } from 'bun:test';
import validType from '../src/utils/validType';

describe('validType', () => {
  test('基础类型：String/Number/Boolean', () => {
    expect(validType('a', String)).toBe(true);
    expect(validType(1, Number)).toBe(true);
    expect(validType(true, Boolean)).toBe(true);

    expect(validType(1, String)).toBe(false);
    expect(validType('1', Number)).toBe(false);
    expect(validType('true', Boolean)).toBe(false);
  });

  test('对象：嵌套字段校验', () => {
    const format = {
      name: String,
      age: Number,
      grade: {
        chinese: Number,
        math: Number,
      },
    };

    expect(
      validType(
        { name: 'n', age: 1, grade: { chinese: 100, math: 99 } },
        format
      )
    ).toBe(true);

    expect(
      validType(
        { name: 'n', age: '1', grade: { chinese: 100, math: 99 } } as any,
        format
      )
    ).toBe(false);
  });

  test('数组：非空且元素都匹配', () => {
    expect(validType(['a', 'b'], [String])).toBe(true);
    expect(validType([], [String])).toBe(false);
    expect(validType(['a', 1] as any, [String])).toBe(false);
  });

  test('strict=false：允许多余字段', () => {
    const format = { name: String };
    expect(validType({ name: 'n', extra: 1 }, format, false)).toBe(true);
  });

  test('strict=true：不允许多余字段', () => {
    const format = { name: String };
    expect(validType({ name: 'n', extra: 1 }, format, true)).toBe(false);
  });

  test('非法格式：数组格式不能为空', () => {
    expect(() => validType(['a'], [] as any)).toThrow();
  });

  test("可选字段占位符：'?' 表示可选 string，-1 表示可选 number", () => {
    const _String = '?' as const;
    const _Number = -1 as const;

    const format = {
      name: _String,
      age: _Number,
      tags: [String],
    };

    // 缺失可选字段：通过（strict=false/true 都应通过）
    expect(validType({ tags: ['a'] }, format, false)).toBe(true);
    expect(validType({ tags: ['a'] }, format, true)).toBe(true);

    // 可选字段为 null/undefined：通过
    expect(
      validType({ name: null, age: undefined, tags: ['a'] } as any, format)
    ).toBe(true);

    // 可选字段存在但类型不对：失败
    expect(validType({ name: 1, tags: ['a'] } as any, format)).toBe(false);
    expect(validType({ age: '1', tags: ['a'] } as any, format)).toBe(false);

    // 必填字段缺失：失败
    expect(validType({}, format as any)).toBe(false);
  });

  test('可选数组字段：[_String]/[_Number] 表示字段可选，存在时为非空数组', () => {
    const _String = '?' as const;
    const _Number = -1 as const;

    const format = {
      tags: [_String],
      nums: [_Number],
      must: [String],
    };

    // 缺失可选数组字段：通过
    expect(validType({ must: ['a'] }, format)).toBe(true);
    expect(
      validType({ tags: undefined, nums: null, must: ['a'] } as any, format)
    ).toBe(true);

    // 可选数组字段存在：必须是非空数组且元素类型正确
    expect(validType({ tags: ['a'], nums: [1], must: ['a'] }, format)).toBe(
      true
    );
    expect(validType({ tags: [], must: ['a'] } as any, format)).toBe(false);
    expect(validType({ tags: [null], must: ['a'] } as any, format)).toBe(false);
    expect(validType({ nums: ['1'], must: ['a'] } as any, format)).toBe(false);

    // 必填数组字段缺失：失败
    expect(validType({ tags: ['a'] } as any, format)).toBe(false);
  });
});
