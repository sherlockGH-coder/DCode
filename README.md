# DCode

DCode 是一个基于 Electron、React 和 TypeScript 的桌面编码助手。它支持多轮对话、工具调用、项目文件操作、MCP 服务、计划模式和可配置的模型连接。

## 开发

```bash
pnpm install
pnpm dev
```

常用检查命令：

```bash
pnpm typecheck
pnpm test
pnpm build
```

应用通过设置页配置模型服务地址和 API 密钥。密钥只保存在本地设置中，不应写入源代码、提交记录或 CI 配置。默认模型列表包含 DeepSeek 兼容模型标识，也可以在设置中使用其他兼容服务。
