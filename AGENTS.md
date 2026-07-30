# AGENTS.md

## 项目定位

这是个人 Electron 应用模板，用来复制为新项目初始化内容。模板核心只保留应用级通用能力，不把具体业务工具混进基础壳。

## 运行与包管理

- 使用 Node.js `^22.12.0 || ^24.0.0`，推荐 Node.js `24.x`；不使用非 LTS 的 Node.js 23。
- 项目固定 `packageManager: pnpm@8.7.0`。
- 执行 pnpm 命令时使用 `corepack pnpm ...`。
- 不要用全局新版 pnpm 直接安装或更新依赖，避免重写旧版 lockfile。

## 前端服务进程

- 如果本次工作启动了 `corepack pnpm dev`、`vite preview`、Electron dev server 或其他前端调试服务，回答结束前必须停止这些进程。
- 如果只是构建或类型检查，没有常驻进程，则不需要额外停止。

## 大需求协作

- 中大型需求先维护 `docs/开发设计文档/` 下的最终设计、执行计划和实施记录。
- 每次实现前读取对应 final design 与 execution plan。
- 完成后更新执行计划台账，并写入 implementation record。

## 模板边界

- 不迁移 FusionKit 的字幕、翻译、重命名、AI Agent、模型配置、代理配置等业务逻辑。
- 更新检查只提示并打开 GitHub Releases，不下载、不执行、不安装。
- 新增页面文案要进入 `src/locales/{zh,zh-Hant,en,ja}/`。
- 保留 macOS/Windows titlebar、窗口按钮和拖拽热区的可用性。

## 验证建议

常规修改后至少运行：

```bash
corepack pnpm typecheck
corepack pnpm i18n:check
```

涉及构建、Electron 主进程或 preload 时运行：

```bash
corepack pnpm build:renderer
```
