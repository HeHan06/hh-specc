import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 每个用例结束后卸载组件，避免前一个用例的 DOM 残留到下一个用例。
afterEach(() => {
  cleanup();
});
