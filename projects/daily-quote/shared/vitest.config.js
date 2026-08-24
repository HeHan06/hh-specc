import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // shared 只放纯逻辑，运行环境固定为 node，禁止依赖 DOM/wx API
    environment: 'node',
    include: ['__tests__/**/*.test.js'],
  },
});
