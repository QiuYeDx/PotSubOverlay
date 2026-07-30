# Electron 个人应用模板最终设计

## 结论

FusionKit 适合作为通用 Electron 桌面壳参考：它已有 React + Vite + Electron、HashRouter、底部路由导航、主题切换动画、全局启动 Loading、Windows/macOS titlebar 和 shadcn/ui/qiuye-ui 基础组件。本模板保留这些“应用级通用能力”，但不迁移字幕翻译、批量重命名、AI Agent、模型配置、代理配置等业务工具。

bili-ticket-node 的更新检查更适合作为模板默认方案：它使用公开 GitHub Releases API 做轻量检查，只提示并打开 release 页面，不依赖 `electron-updater` 的固定发布协议、不下载或执行远程文件。本模板采用可配置仓库的 `GitHub Releases` 检查，并保留可选 CHANGELOG 展示能力。

本项目的最终形态是一个可拷贝为新项目初始内容的个人 Electron 模板。模板必须便于改名、改仓库、删除示例页面和扩展业务模块。

## 目标

- 提供可运行的 Electron + React + TypeScript + Vite 桌面模板。
- 保留 FusionKit 风格的基础 UI、shadcn/ui 配置、qiuye-ui 小组件与通用交互。
- 提供 i18n 能力，默认支持 `zh`、`zh-Hant`、`en`、`ja`。
- 保留底部导航、页面切换动画、深浅色模式切换动画、全局启动 Loading。
- 提供 Windows/macOS 差异化 titlebar、窗口控制按钮和拖拽热区。
- 提供关于页、设置页、主页模板，删除成本低。
- 提供可配置 GitHub Releases 更新检查，支持可选展示远程 CHANGELOG 内容。
- 固定 Node/pnpm 版本规范，整理清晰的 dev/build/release 命令，至少覆盖 macOS 和 Windows。
- 初始化 git，设置合适 `.gitignore`，维护 README、CHANGELOG、AGENTS 规范。

## 非目标

- 不迁移 FusionKit 的具体业务工具、AI SDK 调用、字幕/重命名/文本翻译逻辑。
- 不实现自动下载、后台安装、强制升级或 `electron-updater` 协议。
- 不内置代码签名、公证、Windows 证书签名。
- 不提供完整插件系统或脚手架 CLI；当前模板通过复制仓库目录使用。

## 当前状态

当前仓库原始目录为空，尚未初始化 git，也没有 `package.json`、源码或构建配置。可自由创建模板项目结构。

参考项目：

- `/Users/qiuyedx/Documents/Github/FusionKit`
  - 可复用：Electron 主/预加载结构、Vite 配置、titlebar、bottom nav、theme store、fade mask、i18n、关于页/设置页模板、shadcn/ui 基础组件、qiuye-ui `ScrollableDialog` 和 `DualStateToggle`。
  - 不复用：业务工具、模型/代理配置、electron-updater 复杂发布协议。
- `/Users/qiuyedx/Documents/Github/bili-ticket-node`
  - 可复用：`apps/web/lib/update-check.ts` 的 GitHub Releases 检查思路、dev mock 状态、只打开 release 页的安全边界。

## 最终架构

```text
qiuye-electron-template/
  electron/
    main/
      index.ts
      update.ts
    preload/
      index.ts
    electron-env.d.ts
  src/
    assets/
    components/
      qiuye-ui/
      ui/
      update/
      theme-provider.tsx
    constants/
    hooks/
    i18n/
    lib/
    locales/
    pages/
      About/
      Setting/
      components/
      Home.tsx
    store/
    type/
    utils/
    App.tsx
    main.tsx
    index.css
  docs/开发设计文档/
  build/
  public/
  scripts/
  package.json
  pnpm-lock.yaml
  electron-builder.json
  vite.config.ts
  tsconfig.json
  components.json
  README.md
  CHANGELOG.md
  AGENTS.md
```

### Electron 主进程

`electron/main/index.ts` 负责：

- 创建单实例窗口。
- 设置 `titleBarStyle: "hidden"`，macOS 设置 `trafficLightPosition`。
- 生产环境加载 `dist/index.html`，开发环境加载 Vite dev server。
- 注入启动 Loading 进度事件。
- 阻止生产环境刷新和打开 devtools 快捷键。
- 通过 IPC 暴露窗口控制、系统通知、外部链接打开、更新检查。

窗口默认：

- `width: 1080`
- `height: 786`
- `minWidth: 786`
- `minHeight: 540`
- `resizable: true`
- `show: false`，ready 后再显示

### Preload

`electron/preload/index.ts` 负责：

- 通过 `contextBridge` 暴露受控 `ipcRenderer`。
- 暴露 `electronUtils.getPathForFile`，后续业务如需要文件拖拽可直接复用。
- 注入全局启动 Loading DOM、样式和 motion 动画。
- 根据本地主题存储选择 Loading 明暗色。
- React 渲染完成后通过 `postMessage({ payload: "removeLoading" })` 移除 Loading。

### Renderer Shell

`src/App.tsx` 负责：

- 固定应用根布局：titlebar、内容 ScrollArea、底部导航、全局 Toaster、更新检查组件、主题过渡遮罩。
- 用 `HashRouter` 和 `Routes` 提供模板页面。
- 用 `AnimatePresence` 和 `motion.div` 做路由方向切换。

默认路由：

- `/`：主页模板
- `/about`：关于页模板，含版本、链接、检查更新入口
- `/setting`：设置页模板，含语言、主题、通知、更新检查偏好

底部导航只包含主页、关于、设置，便于新项目添加业务入口。

### 主题和动画

- `src/store/useThemeStore.ts` 使用 Zustand persist 存储 `light | dark | system`。
- `src/pages/components/BottomNavigation.tsx` 复用 FusionKit 截图 + radial mask 的主题切换动效。
- `src/pages/components/FadeMaskLayer.tsx` 渲染主题切换遮罩层，并在切换时重置主滚动区到顶部。
- `src/index.css` 保留 Tailwind CSS 4 + shadcn/ui CSS 变量体系，减少单色倾向，避免模板视觉过重。

### i18n

- `src/i18n/index.ts` 初始化 i18next。
- `src/i18n/resources.ts` 聚合本地 JSON。
- `src/i18n/constants.ts` 管理语言存储 key、默认语言、规范化逻辑。
- 默认命名空间：`common`、`home`、`about`、`setting`。
- 新页面添加文案时必须补齐四种语言文件，或至少在代码中提供合理 `defaultValue`。

### UI 组件

保留 shadcn/ui 基础组件：

- `button`
- `card`
- `badge`
- `dialog`
- `scroll-area`
- `switch`
- `label`
- `alert`
- `sonner`

保留 qiuye-ui：

- `DualStateToggle`
- `ScrollableDialog`

模板页面只依赖上述组件，后续项目可用 `shadcn` CLI 或 qiuye-ui registry 增补组件。

## 更新检查设计

### 配置

`src/constants/app.ts` 提供前端展示配置：

- `APP_NAME`
- `APP_REPO_URL`
- `APP_RELEASES_URL`
- `APP_AUTHOR_URL`
- `APP_BLOG_URL`
- `APP_CONTACT_EMAIL`
- `APP_CHANGELOG_URL`

`electron/main/update.ts` 读取环境变量或 package 配置：

- `VITE_UPDATE_OWNER`
- `VITE_UPDATE_REPO`
- `VITE_UPDATE_RELEASES_API`
- `VITE_UPDATE_RELEASES_URL`
- `VITE_UPDATE_CHANGELOG_URL`

默认仓库可留为空或指向 `QiuYeDx/qiuye-electron-template`，用户复制后只需改 `package.json` 与 `.env`。

### IPC 合约

Renderer 调用：

```ts
window.ipcRenderer.invoke("check-update", {
  source: "manual" | "auto",
  includeChangelog?: boolean,
});
```

Main 返回：

```ts
type UpdateCheckResult =
  | {
      status: "available";
      update: {
        currentVersion: string;
        latestVersion: string;
        latestTag: string;
        releaseUrl: string;
        releasesUrl: string;
        changelog?: ChangelogEntry[];
      };
      message: string;
    }
  | {
      status: "current";
      update: null;
      message: string;
    }
  | {
      status: "error";
      update: null;
      message: string;
    };
```

### 行为

- 自动检查：应用启动后延迟执行，失败时静默，仅可用更新时显示非侵入提示或弹窗。
- 手动检查：关于页按钮触发，始终打开结果弹窗。
- 可用更新：展示当前版本、最新版本、release 链接，可选展示更新日志摘要。
- 最新版本：展示当前已是最新版。
- 错误：展示错误原因，并提供打开 Releases 页面按钮。
- 安全边界：只打开外部 release 页面，不下载、不执行、不替换应用文件。

### 版本比较

- 支持 `v1.2.3`、`1.2.3`、`1.2.3-beta.1` 的基础解析。
- 默认忽略 prerelease release，除非模板后续显式添加 prerelease 配置。
- 多个 release 中选择最高稳定 semver，不只依赖 GitHub latest。

### CHANGELOG

- 可选读取远程 `CHANGELOG.md`。
- 解析 `## [x.y.z] - date` 和 `### Section` 下的 `- item`。
- 只展示 `(currentVersion, latestVersion]` 范围内的条目。
- 获取失败不影响更新检查主结果。

## 设置页模板

默认分组：

- 通用：语言、主题、系统通知测试。
- 更新：自动检查开关、是否显示更新日志、目标仓库提示。

设置使用 localStorage/Zustand 持久化。影响主进程的配置暂不做写回；检查更新仓库以构建/环境配置为准，保证模板项目发布时行为稳定。

## 构建与发布

约定版本：

- Node.js：`^22.12.0 || ^24.0.0`
- 推荐 Node.js：`24.x`，不使用非 LTS 的 Node.js 23
- pnpm：`8.7.0`

`package.json` 必须包含：

- `"packageManager": "pnpm@8.7.0"`
- `engines.node`
- `engines.pnpm`

脚本：

- `dev`：Vite + Electron 开发。
- `build`：类型检查、Vite 构建、electron-builder 当前平台构建。
- `build:renderer`：只构建前端与 Electron bundle。
- `typecheck`：TypeScript 检查。
- `electron:check`：验证 Electron、Chromium 与平滑圆角 CSS 运行时能力。
- `release:dir`：当前平台目录包，便于调试。
- `release:mac`：macOS dmg + zip。
- `release:win`：Windows nsis。
- `release:current`：当前平台标准 release。
- `i18n:check`：检查 i18n key。

所有文档示例使用 `corepack pnpm ...`，避免全局新版 pnpm 修改 lockfile。

## Git 与文档规范

`.gitignore` 忽略：

- `node_modules/`
- `dist/`
- `dist-electron/`
- `release/`
- `.env*` 但保留 `.env.example`
- 系统与编辑器临时文件

`README.md` 必须说明：

- 模板定位。
- 快速开始。
- 改名清单。
- 目录结构。
- dev/build/release 命令。
- 更新检查配置。
- i18n 和 UI 扩展方式。

`CHANGELOG.md` 使用 Keep a Changelog 风格：

- `## [Unreleased]`
- `## [0.1.0] - YYYY-MM-DD`
- 分类使用 `Added`、`Changed`、`Fixed`、`Docs` 等。

`AGENTS.md` 必须记录：

- 回答结束前停止本次启动的前端服务进程。
- 使用 `corepack pnpm` 和 pnpm 8.7.0。
- 不把业务模块混入模板核心。
- 大需求先维护设计/计划/实施记录。

## 风险与边界

- 参考项目依赖版本较新，必须在模板中固定 `packageManager`，避免 lockfile 被新 pnpm 重写。
- Loading 依赖 preload DOM 注入和 renderer ready message，主/预加载/前端三端 channel 名称必须一致。
- titlebar 需要 `app-region` 和 `-webkit-app-region` 同时设置，交互按钮必须 `no-drag`。
- 更新检查依赖 GitHub API，离线、限流、私有仓库都可能失败；失败不应阻断应用启动。
- 当前模板不做代码签名，macOS/Windows 正式分发前需要补充签名和公证配置。

## 验证策略

- `corepack pnpm install --config.confirmModulesPurge=false`
- `corepack pnpm typecheck`
- `corepack pnpm build:renderer`
- `corepack pnpm i18n:check`
- 如启动 dev server 进行视觉验证，结束前必须停止对应进程。
