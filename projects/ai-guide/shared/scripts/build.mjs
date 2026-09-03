/**
 * shared 构建检查：
 * 1. 动态导入所有纯逻辑模块，确保 ESM 语法与相对引用成立；
 * 2. 拒绝 DOM、fetch、localStorage、wx API 等平台依赖，守住 shared 纯逻辑边界。
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirs = ['api', 'constants', 'types', 'utils'];
const bannedPatterns = [
  { label: 'DOM document', pattern: /\bdocument\b/ },
  { label: 'window', pattern: /\bwindow\b/ },
  { label: 'localStorage', pattern: /\blocalStorage\b/ },
  { label: 'fetch', pattern: /\bfetch\s*\(/ },
  { label: 'wx API', pattern: /\bwx\./ },
];

async function listJsFiles(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listJsFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      result.push(fullPath);
    }
  }
  return result;
}

const files = [];
for (const dir of sourceDirs) {
  files.push(...(await listJsFiles(path.join(rootDir, dir))));
}

for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const { label, pattern } of bannedPatterns) {
    if (pattern.test(source)) {
      throw new Error(`${path.relative(rootDir, file)} 检测到平台依赖：${label}`);
    }
  }
  await import(pathToFileURL(file).href);
}

console.log(`shared build ok（已校验 ${files.length} 个纯逻辑模块）`);
