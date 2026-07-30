# Electron 现代运行时分支最终设计

## 结论

在长期分支 `electron-modern` 中将 Electron 从声明版本 `^33.2.0`（当前锁定 `33.4.11`）升级到 `^41.10.3`，`main` 继续保留 Electron 33。

Electron 41.10.3 是本次约束下的推荐版本：

- 它是 2026-07-30 时 Electron 官方仍支持的三条稳定主线中，最后一个没有引入“macOS 系统通知要求应用签名”行为变化的版本。
- 它搭载 Chromium 146，原生支持从 Chrome 139 开始提供的 `corner-shape: superellipse(...)`，可以让 qiuye-ui 的平滑圆角增强样式实际生效。
- 41.10.3 已包含 41 系列近期的 Chromium/V8 回移修复和 Windows 硬件加速修复，比原来的 Electron 33 / Chromium 130 获得更完整的 Web 平台和安全更新。
- 它处于官方支持窗口的最老一档，只接收安全修复。这是保留无签名系统通知能力必须接受的主要取舍。

不选择 Electron 42/43。Electron 42 起，macOS 主进程 `Notification` 改用 `UNNotification`，Electron 官方明确说明应用必须签名才能显示通知；未签名应用会触发 `failed` 事件。模板当前明确不内置代码签名，系统通知又是设置页已有的通用能力，因此不能用升级换取该功能退化。

## 候选对比

| Electron | Chromium | Node.js | 2026-07-30 状态 | 平滑圆角 | 结论 |
|---|---:|---:|---|---|---|
| 33.4.11 | 130 | 20.18.3 | 已停止支持 | 不支持，只有 `border-radius` 回退 | 保留在 `main` |
| 38.8.6 | 140 | 22.22.0 | 已停止支持 | 支持 | 不选，已停止安全维护 |
| 40.10.6 | 144 | 24.15.0 | 已停止支持 | 支持 | 不选，已停止安全维护 |
| 41.10.3 | 146 | 24.18.0 | 官方支持，安全修复档 | 支持 | 本分支采用 |
| 42.8.0 | 148 | 24.18.0 | 官方支持 | 支持 | 不选，macOS 通知要求签名 |
| 43.2.0 | 150 | 24.18.0 | 最新稳定版 | 支持 | 不选，继承通知签名要求 |

版本和依赖数据来源：

- [Electron Releases](https://releases.electronjs.org/)
- [Electron Releases and support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
- [Electron breaking changes](https://www.electronjs.org/docs/latest/breaking-changes)
- [MDN browser compatibility data: corner-shape](https://github.com/mdn/browser-compat-data/blob/main/css/properties/corner-shape.json)

## 目标

- 在不修改 `main` 的前提下提供一个可长期维护的新 Electron 运行时分支。
- 保留当前模板的 macOS/Windows titlebar、preload、IPC、系统通知和更新检查能力。
- 让 qiuye-ui `SmoothCorners` 使用的 `corner-shape: superellipse(...)` 在 Electron renderer 中原生生效。
- 对 Electron 版本、Chromium 能力和 qiuye-ui CSS 建立可重复的自动检查。
- 保持 `packageManager: pnpm@8.7.0`，所有依赖操作仍使用 `corepack pnpm`。

## 非目标

- 不把 `electron-modern` 合并到 `main`。
- 不在本次工作中加入 Apple/Windows 签名、公证或证书配置。
- 不迁移任何 FusionKit 业务逻辑。
- 不在本次工作中修改 `/Users/qiuyedx/Documents/Github/qiuye-fe-cli`；只记录后续模板版本选择的接入契约。
- 不顺带升级 Vite、React、electron-builder 或其他无关依赖，除非验证证明 Electron 41 无法与现有工具链配合。

## 运行环境变化

Electron 41.10.3 的 npm 包要求 Node.js `>=22.12.0`。Node 22 和 Node 24 都满足要求，项目开发环境因此调整为：

- Node.js：`^22.12.0 || ^24.0.0`
- 推荐 Node.js：`24.x`
- 排除 Node.js 23：它是非 LTS 奇数版本，不作为模板基线
- pnpm：继续固定 `8.7.0`

Electron 内嵌 Node.js 为 24.18.0，这不要求构建主机也必须使用 Node 24。Node 22 适合仍在该 LTS 上的开发环境；Node 24 与 Electron 主进程/preload 的实际运行时一致，因此作为本分支推荐版本。直接依赖的 `@types/node` 对齐到 24，避免模板在主进程中误判 Node 24 API 类型。

## 依赖与组件方案

### Electron

`package.json` 使用 `electron: ^41.10.3`，锁文件解析为本次验证的 41.10.3。保留 caret 范围，使同一主版本的后续安全和缺陷修复可以通过显式依赖维护进入本分支，不自动跨到 Electron 42。

### qiuye-ui 平滑圆角

项目已有 shadcn/ui 配置和 `@qiuye-ui` registry，采用 registry 的 `SmoothCorners` 组件，不自行重写算法。组件依赖 `@qiuyedx/smooth-corners@0.1.0`，并遵守渐进增强契约：

- 基础规则必须存在 `border-radius: var(--sc-r)` 回退。
- 增强规则必须由 `@supports (corner-shape: superellipse(2))` 保护。
- 支持时使用补偿半径 `--sc-i` 和 `corner-shape: var(--sc-s)`，其中 `--sc-s` 的值为 `superellipse(...)`。
- 不在同一个元素上继续叠加 Tailwind `rounded-*`，避免覆盖组件生成的半径。
- 主页主信息区使用一次真实的 `SmoothCorners asChild`，让组件被生产构建和实际页面覆盖。

## Electron 迁移检查

当前代码使用的 Electron API 包括：

- `app`、`BrowserWindow`、`ipcMain`、`Menu`、`Notification`、`shell`
- preload 中的 `ipcRenderer`、`contextBridge`、`webUtils`
- `BrowserWindow` 的隐藏 titlebar、macOS traffic light 位置和窗口控制

Electron 34-41 的破坏性变更中没有移除这些当前调用方式。相关差异中：

- Electron 38 移除 macOS 11 支持；模板文档不承诺 macOS 11，本次不额外恢复。
- Electron 39 的桌面音频捕获权限变化与当前模板无关。
- Electron 40 弃用 renderer 直接访问 `clipboard`；当前模板没有使用。
- Electron 41 的 PDF WebContents 行为变化与当前模板无关。

## 验证设计

新增 `electron:check`，通过已安装的 Electron 启动一次短生命周期隐藏窗口，并验证：

- `process.versions.electron` 为 41.10.3。
- `process.versions.chrome` 的主版本至少为 139。
- renderer 中 `CSS.supports("corner-shape", "superellipse(2)")` 返回 `true`。
- 注入 `@qiuyedx/smooth-corners` 导出的真实 CSS 和变量后，目标元素的 computed style 使用增强半径与非默认 `corner-shape`。

常规验证：

```bash
corepack pnpm typecheck
corepack pnpm i18n:check
corepack pnpm build:renderer
corepack pnpm electron:check
corepack pnpm release:dir
```

全套验证使用推荐的 Node 24；另用 Node 22 至少运行 `typecheck`，确认两条声明支持的 LTS 都能使用。`electron:check` 和 `release:dir` 是短生命周期命令，不启动常驻前端服务。若额外启动 `dev`，结束前必须停止。

## 长期分支与 CLI 接入

- `main`：继续提供 Electron 33 兼容模板。
- `electron-modern`：保存 Electron 41 和后续经约束评估通过的新运行时版本。
- 后续 `/Users/qiuyedx/Documents/Github/qiuye-fe-cli` 可提供模板运行时选项，将旧版映射到 `main`、现代版映射到 `electron-modern`。
- 在没有签名方案或等价通知替代方案前，不得把本分支推进到 Electron 42+。
- 每次推进 Electron 主版本前重新检查官方三版本支持策略、breaking changes、宿主 Node engines、macOS/Windows titlebar 和系统通知。

## 风险与回滚

- Electron 41 已处于官方支持窗口的最老一档，维护寿命短；分支说明和实施记录必须保留这一事实，不能把它描述为长期安全版本。
- Node 22 最低版本会淘汰旧 Node 20 开发环境；README、AGENTS 和 `package.json` 必须保持一致。
- qiuye-ui 平滑圆角在 Electron 41 生效，但在普通 Safari/Firefox Web 环境仍会按组件设计回退为标准圆角。
- 回滚只需放弃 `electron-modern` 分支；`main` 不接收本次提交。
