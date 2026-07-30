# QiuYe Electron Template

个人 Electron 应用模板，用来复制为新项目的初始化内容。它保留了通用桌面壳体验：React + Vite + Electron、shadcn/ui、qiuye-ui 小组件、i18n、深浅色主题切换动画、启动 Loading、底部导航、关于页、设置页，以及基于 GitHub Releases 的轻量更新检查。

## 环境

- Node.js: `^22.12.0 || ^24.0.0`，推荐 `24.x`（不使用非 LTS 的 Node.js 23）
- pnpm: `8.7.0`

建议统一使用：

```bash
corepack enable
corepack prepare pnpm@8.7.0 --activate
corepack pnpm install --config.confirmModulesPurge=false
```

## 常用命令

```bash
corepack pnpm dev
corepack pnpm typecheck
corepack pnpm i18n:check
corepack pnpm build:renderer
corepack pnpm electron:check
corepack pnpm release:dir
corepack pnpm release:mac
corepack pnpm release:win
```

`dev` 会启动 Vite + Electron；如果由 AI Agent 启动调试服务，结束前必须停止对应进程。

## 复制成新项目后优先修改

1. `package.json`: `name`、`productName`、`version`、`description`、`author`、`template.update`。
2. `electron-builder.json`: `appId`、`shortcutName`、图标和产物命名。
3. `.env.example`: GitHub Releases 目标仓库。
4. `src/constants/app.ts`: 应用名、仓库、作者链接、联系方式。
5. `src/assets/app-logo.svg`、`build/icon.*`、`public/favicon.ico`。
6. `README.md`、`CHANGELOG.md`、`AGENTS.md`。

## 目录结构

```text
electron/          Electron main/preload
src/components/    shadcn/ui、qiuye-ui、更新弹窗
src/pages/         Home/About/Setting 模板页
src/i18n/          i18next 初始化与资源聚合
src/locales/       zh、zh-Hant、en、ja 文案
src/store/         Zustand 状态与偏好
docs/开发设计文档/  大需求设计、执行计划、实施记录
build/             electron-builder 图标资源
public/            静态资源
scripts/           项目检查脚本
```

## 更新检查

模板默认使用 GitHub Releases API：

- 选择最高稳定版本。
- 比较当前 `package.json`/Electron 版本。
- 只提示并打开 Releases 页面。
- 不下载、不执行、不自动安装。
- 可选读取远程 `CHANGELOG.md` 并展示相关版本条目。

可通过环境变量覆盖：

```bash
VITE_UPDATE_OWNER=QiuYeDx
VITE_UPDATE_REPO=qiuye-electron-template
VITE_UPDATE_RELEASES_URL=https://github.com/QiuYeDx/qiuye-electron-template/releases
VITE_UPDATE_CHANGELOG_URL=https://raw.githubusercontent.com/QiuYeDx/qiuye-electron-template/main/CHANGELOG.md
```

## i18n

默认命名空间：

- `common`
- `home`
- `about`
- `setting`

新增页面或文案后同步更新 `src/locales/{zh,zh-Hant,en,ja}/`，并运行：

```bash
corepack pnpm i18n:check
```

## 设计与实施记录

本模板初始化设计见：

- `docs/开发设计文档/electron_template_scaffold_final_design.md`
- `docs/开发设计文档/electron_template_scaffold_execution_plan.md`

新版 Electron 长期分支的版本选择、兼容边界和实施进度见：

- `docs/开发设计文档/electron_modern_runtime_final_design.md`
- `docs/开发设计文档/electron_modern_runtime_execution_plan.md`

后续中大型改动继续沿用该目录下的设计、执行计划和实施记录流程。
