# DCode

## 中文

DCode 是一个基于 Electron、React 和 TypeScript 的桌面编码助手。它提供对话、项目文件操作、工具调用、MCP 服务和计划模式等功能。

### 开发

需要 Node.js 22 和 pnpm 10：

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

模型服务地址和 API 密钥在应用设置中配置。密钥只保存在本地，不要提交到源代码或 CI 配置。默认模型列表包含 DeepSeek 兼容模型标识，也可以配置其他兼容服务。

## English

DCode is a desktop coding assistant built with Electron, React, and TypeScript. It provides chat, project file operations, tool calls, MCP services, and plan mode.

### Development

Node.js 22 and pnpm 10 are required:

```bash
pnpm install
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Configure the model service URL and API key in the app settings. Keys are stored locally and must not be committed to source files or CI configuration. The default model list includes DeepSeek-compatible identifiers; other compatible services can be configured as well.

## License

MIT
