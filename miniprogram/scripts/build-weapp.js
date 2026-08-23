#!/usr/bin/env node
// 每日一句小程序构建校验脚本。
// 官方 Taro CLI（@tarojs/cli）未纳入本期已声明依赖，本脚本用已声明的 Babel 工具链做
// 「编译 + 配置合规 + 包体积」门禁，作为 npm run build:weapp 的可执行验证命令。

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const MAX_MAIN_PACKAGE_BYTES = 2 * 1024 * 1024;
const JS_EXT = /\.(js|jsx)$/;
const ASSET_EXT = /\.(scss|sass|css|json|wxml|wxss|png|jpg|jpeg|gif|svg)$/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

// 用与 Jest 一致的三段 preset 做编译检查，确保 JSX/ESM 语法可被 Taro 工具链消费。
function compileFile(file) {
  const code = fs.readFileSync(file, 'utf8');
  babel.transformSync(code, {
    filename: file,
    sourceType: 'module',
    babelrc: false,
    configFile: false,
    presets: [
      ['taro', { framework: 'react', ts: true }],
      ['@babel/preset-env', { modules: 'commonjs' }],
      ['@babel/preset-react'],
    ],
  });
}

function loadAppConfig() {
  const file = path.join(SRC_DIR, 'app.config.js');
  const code = fs.readFileSync(file, 'utf8');
  const { code: cjs } = babel.transformSync(code, {
    filename: file,
    sourceType: 'module',
    babelrc: false,
    configFile: false,
    presets: [['@babel/preset-env', { modules: 'commonjs' }]],
  });
  const module = { exports: {} };
  const run = new Function('module', 'exports', cjs);
  run(module, module.exports);
  return module.exports.default || module.exports;
}

function assertAppConfig(config) {
  if (!config || !Array.isArray(config.pages) || config.pages.length === 0) {
    throw new Error('app.config.js 必须声明非空 pages 数组');
  }
  if (config.pages[0] !== 'pages/quote/index') {
    throw new Error('首页必须为 pages/quote/index');
  }
  if ('tabBar' in config) {
    throw new Error('本期不配置 tabBar');
  }
  if ('permission' in config || 'requiredPrivateInfos' in config) {
    throw new Error('本期不申请任何隐私权限');
  }
}

// 页面禁止裸调 wx.*，平台能力必须走 src/platform/ 统一封装。
function assertNoBareWx() {
  const pagesDir = path.join(SRC_DIR, 'pages');
  const files = walk(pagesDir).filter((file) => JS_EXT.test(file));
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    if (/wx\./.test(code)) {
      throw new Error(`页面禁止裸调 wx.*，请封装到 src/platform：${path.relative(ROOT, file)}`);
    }
  }
}

function measureMainPackage() {
  // 测试文件与测试支撑文件不打进小程序主包，统计时排除。
  const files = walk(SRC_DIR).filter((file) => {
    if (/test\.(js|jsx)$/.test(file) || file.includes(path.sep + 'test' + path.sep)) return false;
    return JS_EXT.test(file) || ASSET_EXT.test(file);
  });
  let total = 0;
  const detail = [];
  for (const file of files) {
    const size = fs.statSync(file).size;
    total += size;
    detail.push(`${path.relative(ROOT, file)} ${size}B`);
  }
  return { total, detail };
}

function main() {
  const jsFiles = walk(SRC_DIR).filter((file) => JS_EXT.test(file));
  for (const file of jsFiles) {
    compileFile(file);
  }

  const config = loadAppConfig();
  assertAppConfig(config);
  assertNoBareWx();

  const { total, detail } = measureMainPackage();
  if (total > MAX_MAIN_PACKAGE_BYTES) {
    throw new Error(`主包源体积 ${total}B 超过 2MB 上限`);
  }

  console.log('weapp 构建校验通过');
  console.log(`- 编译文件数：${jsFiles.length}`);
  console.log(`- 页面路由：${config.pages.join(', ')}`);
  console.log(`- 主包源体积：${total}B（上限 ${MAX_MAIN_PACKAGE_BYTES}B）`);
  detail.forEach((line) => console.log(`  - ${line}`));
}

try {
  main();
} catch (error) {
  console.error(`build:weapp 失败：${error.message}`);
  process.exit(1);
}
