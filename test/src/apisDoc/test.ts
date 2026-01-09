import type { ApisDoc } from '../../../src/type';

export default {
  header: {
    example: {
      testParam: 'test',
    },
    desc: [
      {
        name: 'testParam',
        desc: '测试参数',
      },
    ],
  },
  request: {
    example: {
      name: '张三',
      age: 18,
      grade: {
        chinese: 90,
        math: 95,
        english: 98,
      },
    },
    desc: [
      {
        name: 'name',
        desc: '姓名',
      },
      {
        name: 'age',
        desc: '年龄',
      },
    ],
  },
  response: {
    example: {
      name: '张三',
      age: 18,
    },
    desc: [
      {
        name: 'name',
        desc: '姓名',
      },
      {
        name: 'age',
        desc: '年龄',
      },
    ],
  },
} satisfies ApisDoc;
