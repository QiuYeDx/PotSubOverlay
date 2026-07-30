# 工作包 EMR-001：Electron 41 运行时升级

## 基本信息

- 日期：2026-07-30
- 状态：已完成
- 对应执行计划工作包：DOC-EMR-001、ENV-EMR-001、UI-EMR-001、QA-EMR-001、QA-EMR-002
- 分支：`electron-modern`

## 本次实现内容

- 对比 Electron 33、38、40、41、42、43 的 Chromium/Node 基线、官方支持状态、平滑圆角能力和 breaking changes。
- 采用 Electron 41.10.3。它是仍可保留无签名 macOS 系统通知行为、同时原生支持 `corner-shape` 的最后一个稳定主版本。
- 开发环境支持 Node.js 22.12+ 与 Node.js 24，推荐 Node.js 24；继续固定 pnpm 8.7.0。
- 从 qiuye-ui registry 接入 `SmoothCorners`，并将主页主信息区作为真实使用点。
- 新增短生命周期 Electron runtime 检查，验证真实 Electron/Chromium 版本和 `@qiuyedx/smooth-corners` computed style。
- 保留现有 electron-builder 24.13.3；目录包验证证明无需连带升级。

## 修改文件

- `package.json`
- `pnpm-lock.yaml`
- `AGENTS.md`
- `README.md`
- `CHANGELOG.md`
- `src/components/qiuye-ui/smooth-corners.tsx`
- `src/pages/Home.tsx`
- `scripts/check-electron-runtime.mjs`
- `docs/开发设计文档/electron_template_scaffold_final_design.md`
- `docs/开发设计文档/electron_modern_runtime_final_design.md`
- `docs/开发设计文档/electron_modern_runtime_execution_plan.md`
- `docs/开发设计文档/electron_modern_runtime_implementation_records/2026-07-30_EMR-001_electron-41-runtime-upgrade.md`

## 接口或数据结构变化

- `engines.node`：`>=18.18.0 <23` 改为 `^22.12.0 || ^24.0.0`。
- Electron：锁定结果从 33.4.11 改为 41.10.3。
- `@types/node`：锁定结果从 22.20.0 改为 24.13.3。
- 新增依赖 `@qiuyedx/smooth-corners@0.1.0`。
- 新增命令 `corepack pnpm electron:check`。
- 新增 `SmoothCorners` 组件 API；没有修改 IPC、更新检查或系统通知合约。

## 验证结果

执行环境：

```text
Node.js 22.22.1 / 24.18.0
pnpm 8.7.0（通过 corepack）
macOS arm64
```

执行命令：

```text
corepack pnpm install --frozen-lockfile --config.confirmModulesPurge=false
corepack pnpm typecheck
corepack pnpm i18n:check
corepack pnpm build:renderer
corepack pnpm electron:check
corepack pnpm release:dir
```

结果：

- Node 22.22.1 和 Node 24.18.0 下 frozen install 均通过。
- Node 22.22.1 和 Node 24.18.0 下 `typecheck` 均通过。
- i18n key 检查通过。
- renderer、main、preload 构建通过；保留原有 renderer chunk 大于 500 kB 的非阻塞警告。
- Electron runtime 检查通过：Electron 41.10.3、Chromium 146.0.7680.216、内嵌 Node 24.18.0。
- `CSS.supports("corner-shape", "superellipse(2)")` 为 `true`。
- qiuye-ui CSS computed style：`borderRadius = 40.8px`，`cornerShape = superellipse(1.8741)`。
- electron-builder 24.13.3 成功生成 `release/0.1.0/mac-arm64/QiuYe Electron Template.app`，按模板约束未签名。
- 首次沙箱内目录包验证因无法写入 electron-builder 标准缓存而失败；允许标准缓存写入后同一命令通过，不属于项目兼容问题。

## 未完成事项

- Electron 41 位于 2026-07-30 官方三条支持主线的最老一档，后续维护窗口较短。
- 在没有签名方案或等价通知替代方案前，不把本分支推进到 Electron 42+。
- qiuye-fe-cli 的 `main` / `electron-modern` 模板版本选择尚未实现，留给 CLI 仓库单独设计。

## 下一步建议

- 在 `/Users/qiuyedx/Documents/Github/qiuye-fe-cli` 增加模板运行时选项：兼容版指向 `main`，现代版指向 `electron-modern`。
- 每次推进本分支 Electron 主版本前重新执行 breaking changes、签名要求和 `electron:check` 审核。
