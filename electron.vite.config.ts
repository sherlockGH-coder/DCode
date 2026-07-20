import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // ----- 主进程构建配置 -----
  main: {
    plugins: [externalizeDepsPlugin()], // 把 node_modules 的所有包标记为外部依赖
  },

  // ----- Preload 脚本构建配置 -----
  preload: {
    plugins: [externalizeDepsPlugin()],
  },

  // ----- 渲染进程（React）构建配置 -----
  renderer: {
    plugins: [react(), tailwindcss()],
  },
});
