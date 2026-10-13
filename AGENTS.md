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
- 双语按“主语言 / 第二语言”角色工作，语言表（名称、字体栈、示例文本）集中在 `src/shared/languages.ts`；业务逻辑与文案里不要写死具体语言组合。
- 字幕窗口创建后始终保持显示，“隐藏字幕”是页面内淡出（`overlay:visible`）；不要改回 `win.hide()/show()`，系统窗口动画会造成闪烁。
- 托盘菜单是自绘的透明窗口（`windows/tray-menu.ts` + `tray-menu.html`），因为 Windows 原生菜单无法主题化；新增菜单项在 `tray.ts` 的 `menuState()` 与 `src/tray-menu/TrayMenu.tsx` 同步修改。Windows 重新显示窗口时会先放出它隐藏前的最后一帧，所以菜单关闭走 `tray-menu:hide` → 页面淡出并画出空帧 → `tray-menu:hidden` → `win.hide()`，不要直接 `win.hide()`；阴影必须落在 `TRAY_MENU_SHADOW_MARGIN` 以内。
- 简洁模式是独立的无边框透明窗口（`index.html?view=compact`，`COMPACT_VIEW`），由 `ControlWindow` 管理：切换时隐藏一个、显示另一个，不要改回调整同一个窗口的尺寸（Windows 的 8px 窗口圆角无法放大）。主进程推送用 `send()`（两个页面都收）或 `sendActive()`（只发当前页面，如快照）。
- 平滑圆角用 `rounded-smooth-*`（`src/smooth-corners.css`）；`cn()` 已让它与 `rounded-*` 互相覆盖。嵌套圆角按“外半径 = 内半径 + 间距”取值；胶囊和圆形保持 `rounded-full`。
- 绝对定位的装饰层（如预览舞台里的字幕和占位文字）必须 `pointer-events-none`，避免挡住其上的按钮。
- 主进程只把原生模块（koffi）设为 external，其余依赖打包进 bundle；electron-builder 只携带 koffi 与 `@koromix/koffi-win32-x64`。新增原生依赖时要同步 `vite.config.ts` 的 `mainExternal` 和 `electron-builder.json` 的 `files` / `asarUnpack`。
- 播放控制只发给当前跟随的 PotPlayer 实例，且一律 `PostMessage`。PotPlayer 跳转期间的读数不可靠（旧位置、目标时间本身、临时 0、“已停止”），判断落点用 `Controller.checkSeekLanding` 的逐次轮询，不要改成固定延时读取。
- 前台程序识别（`foreground.ts`）必须忽略 PotPlayer、本应用和系统界面，否则 Alt+Tab 会让按程序的字幕位置来回跳。`placementProfiles` 与 `media` 一样不走 `mergeKnown`，用专门的方法读写。
- QA 中凡是会操作真实 PotPlayer 的脚本，先用 `follow` 步骤锁定自己用 `/new` 打开的测试实例；不要向用户正在使用的播放器发送播放控制。
- 模板文件在 Windows 上以 CRLF 检出（`core.autocrlf=true`），脚本化的多行替换要考虑行尾。

## UI 组件

- shadcn/ui 使用 `radix-nova` 风格（`radix-ui` 单包），通过 `pnpm dlx shadcn@latest add <name>` 安装；CLI 生成的 `from "cn"` 要改回 `@/lib/utils`（它扩展了 `rounded-smooth` 的合并规则）。
- 重装组件后要还原的定制：`rounded-*` 改为 `rounded-smooth-*`（`rounded-full`、单侧圆角、`rounded-[inherit]` 与箭头的小圆角除外），ScrollArea 视口加 `[corner-shape:inherit]`，Button 与 Switch 带 `cursor-pointer`，TooltipTrigger 只在 `:focus-visible` 时因聚焦弹出，`sonner.tsx` 从 `@/store/useThemeStore` 取主题（不用 next-themes）。
- nova 默认值与旧版不同：Popover / Tooltip 内容已改回块级布局；Select 的 `p-1` 在 Viewport 上；SelectTrigger、Switch 等用 `data-[size=sm]:*` 变体设置尺寸，覆盖时要写同一变体；Card 描边是外侧 `ring-1`，紧贴滚动区或 `overflow-hidden` 边缘时要留出 1px。
- `--radius-2xl` 及以上沿用 Tailwind 默认值，字幕舞台和字幕窗口的 `rounded-smooth-2xl` 依赖它。

## 前端服务进程

- 如果本次工作启动了 `corepack pnpm dev`、`vite preview`、Electron 进程或其他调试服务，回答结束前必须停止这些进程。

## 大需求协作

- 中大型需求先维护 `docs/开发设计文档/` 下的最终设计、执行计划和实施记录（当前主线：`potsuboverlay_*`）。
- 每次实现前读取对应 final design 与 execution plan；完成后更新执行计划台账，并写入 implementation record。

## 约定

- 每次发布或合入用户可见的改动，都要更新 `CHANGELOG.md`（中文，按“新增 / 优化 / 修复 …”分组，格式见 `docs/CHANGELOG_TEMPLATE.md`）；升级版本号时必须同时写好对应条目，`corepack pnpm check` 中的 `changelog:check` 会拦截缺失的版本。

- 新增页面文案要进入 `src/locales/{zh,zh-Hant,en,ja}/`，托盘文案在 `electron/main/tray.ts`。
- 更新检查只提示并打开 GitHub Releases，不下载、不执行、不安装。
- 保留 Windows titlebar、窗口按钮和拖拽热区的可用性。
- 默认快捷键须在常见环境下可注册（避免 `Ctrl+Alt+E/L/M/O/W/A/F/R/Space` 等常被占用的组合）。

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
