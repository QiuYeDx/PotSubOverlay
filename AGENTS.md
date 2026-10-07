# AGENTS.md

## 项目定位

PotSubOverlay：读取 PotPlayer 正在播放的文件与进度，把同名外挂字幕以透明、置顶、鼠标穿透的字幕条显示在游戏画面上。只支持 Windows 11。基于 qiuye-electron-template 的 `electron-modern` 分支（Electron 41）。

## 运行与包管理

- 使用 Node.js `^22.12.0 || ^24.0.0`，推荐 Node.js `24.x`；不使用非 LTS 的 Node.js 23。
- 项目固定 `packageManager: pnpm@8.7.0`，执行 pnpm 命令时使用 `corepack pnpm ...`。
- 不要用全局新版 pnpm 直接安装或更新依赖，避免重写旧版 lockfile。

## 架构要点

- 主进程（`electron/main/`）持有全部状态：PotPlayer 适配（`player/`）、字幕引擎（`subtitle/`，纯 TS，可单测）、设置（`settings.ts`）、窗口（`windows/`）。渲染进程只展示与发起 IPC。
- PotPlayer 取路径必须用 `PostMessage` + `WM_COPYDATA`（`hookWindowMessage`），不要改成 `SendMessage`：回复会在 FFI 调用期间重入主线程。
- 字幕窗口（`overlay.html` / `src/overlay/`）是独立的轻量页面：不引入 i18next、路由和模板 loading；文案在 `src/overlay/strings.ts`。
- `src/shared/` 是主进程与渲染进程共享的类型和默认值，不得引入 Node 或 DOM API。
- 主进程只把原生模块（koffi）设为 external，其余依赖打包进 bundle；electron-builder 只携带 koffi 与 `@koromix/koffi-win32-x64`。新增原生依赖时要同步 `vite.config.ts` 的 `mainExternal` 和 `electron-builder.json` 的 `files` / `asarUnpack`。
- 模板文件在 Windows 上以 CRLF 检出（`core.autocrlf=true`），脚本化的多行替换要考虑行尾。

## 前端服务进程

- 如果本次工作启动了 `corepack pnpm dev`、`vite preview`、Electron 进程或其他调试服务，回答结束前必须停止这些进程。

## 大需求协作

- 中大型需求先维护 `docs/开发设计文档/` 下的最终设计、执行计划和实施记录（当前主线：`potsuboverlay_*`）。
- 每次实现前读取对应 final design 与 execution plan；完成后更新执行计划台账，并写入 implementation record。

## 约定

- 新增页面文案要进入 `src/locales/{zh,zh-Hant,en,ja}/`，托盘文案在 `electron/main/tray.ts`。
- 更新检查只提示并打开 GitHub Releases，不下载、不执行、不安装。
- 保留 Windows titlebar、窗口按钮和拖拽热区的可用性。
- 默认快捷键须在常见环境下可注册（避免 `Ctrl+Alt+E/L/M/O` 等常被占用的组合）。

## 验证建议

常规修改后至少运行：

```bash
corepack pnpm check
```

涉及主进程、preload、打包时运行：

```bash
corepack pnpm release:dir
```

UI 变更用 `POTSUB_FAKE_PLAYER` + `POTSUB_QA_SCRIPT` 截图验收（见 `electron/main/qa.ts`），不要截取用户桌面。
