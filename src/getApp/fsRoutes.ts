import fs from 'node:fs';
import path from 'node:path';

/**
 * 同步遍历目录，收集 `.ts/.js` API 文件路径（排除 `.d.ts`）。
 *
 * @param dir - apis 根目录
 */
export function walkApiFilesSync(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) return [];

  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!e.isFile()) continue;
      if (e.name.endsWith('.d.ts')) continue;
      if (e.name.endsWith('.ts') || e.name.endsWith('.js')) {
        out.push(full);
      }
    }
  }
  return out;
}

/**
 * 将 api 文件路径映射为路由路径：
 * - `apis/index.ts` -> `/`
 * - `apis/user/index.ts` -> `/user`
 * - `apis/user/login.ts` -> `/user/login`
 *
 * @param apisRoot - apis 根目录
 * @param filePath - API 文件路径
 */
export function toRoutePath(apisRoot: string, filePath: string): string {
  const rel = path.relative(apisRoot, filePath);
  const noExt = rel.replace(/\.(ts|js)$/, '');
  const normalized = noExt.split(path.sep).join('/');
  if (normalized === 'index') return '/';
  if (normalized.endsWith('/index'))
    return `/${normalized.slice(0, -'/index'.length)}`;
  return `/${normalized}`;
}
