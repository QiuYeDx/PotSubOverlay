# Electron 现代运行时分支执行计划

## 使用方式

每次维护 `electron-modern` 前先读取：

- `docs/开发设计文档/electron_modern_runtime_final_design.md`
- `docs/开发设计文档/electron_modern_runtime_execution_plan.md`

然后认领最小工作包，完成验证后更新台账，并在 `docs/开发设计文档/electron_modern_runtime_implementation_records/` 写实施记录。

## 状态规则

只使用 `未开始`、`进行中`、`已完成`、`阻塞`、`废弃`。只有实现已落地且相关验证通过时才能标为 `已完成`。

## 进度台账

| 工作包 | 状态 | 完成日期 | 关键文件 | 验证 | 实施记录 | 未解决事项 |
|---|---|---:|---|---|---|---|
| DOC-EMR-001 版本调研与最终设计 | 已完成 | 2026-07-30 | `docs/开发设计文档/electron_modern_runtime_final_design.md`; `docs/开发设计文档/electron_modern_runtime_execution_plan.md` | 官方版本、支持策略、breaking changes 与 CSS 兼容数据交叉检查 | `docs/开发设计文档/electron_modern_runtime_implementation_records/2026-07-30_EMR-001_electron-41-runtime-upgrade.md` | - |
| ENV-EMR-001 Node 与 Electron 依赖升级 | 已完成 | 2026-07-30 | `package.json`; `pnpm-lock.yaml`; `README.md`; `AGENTS.md` | Node 22/24 + pnpm 8.7 frozen install；Node 22/24 `typecheck` | `docs/开发设计文档/electron_modern_runtime_implementation_records/2026-07-30_EMR-001_electron-41-runtime-upgrade.md` | - |
| UI-EMR-001 qiuye-ui 平滑圆角接入 | 已完成 | 2026-07-30 | `src/components/qiuye-ui/smooth-corners.tsx`; `src/pages/Home.tsx` | Node 22/24 `typecheck`; renderer build | `docs/开发设计文档/electron_modern_runtime_implementation_records/2026-07-30_EMR-001_electron-41-runtime-upgrade.md` | - |
| QA-EMR-001 Electron/CSS 运行时检查 | 已完成 | 2026-07-30 | `scripts/check-electron-runtime.mjs`; `package.json` | `electron:check`：Electron 41.10.3 / Chromium 146，原生 superellipse 生效 | `docs/开发设计文档/electron_modern_runtime_implementation_records/2026-07-30_EMR-001_electron-41-runtime-upgrade.md` | - |
| QA-EMR-002 构建与目录包验证 | 已完成 | 2026-07-30 | `dist/`; `dist-electron/`; `release/` | `i18n:check`; `build:renderer`; `release:dir` | `docs/开发设计文档/electron_modern_runtime_implementation_records/2026-07-30_EMR-001_electron-41-runtime-upgrade.md` | 目录包按模板约束跳过代码签名 |
| FOLLOW-CLI-001 脚手架模板版本选项 | 未开始 | - | `/Users/qiuyedx/Documents/Github/qiuye-fe-cli` | 由 CLI 项目另行设计和验证 | - | 不在本次仓库改动范围 |

## 实施顺序

1. 完成 `ENV-EMR-001`，先让 Node 与 Electron 依赖约束自洽。
2. 完成 `UI-EMR-001`，安装 registry 组件并在真实页面使用。
3. 完成 `QA-EMR-001`，验证 Electron 内的实际 Chromium CSS 能力。
4. 完成 `QA-EMR-002`，确认现有 Vite/electron-builder 工具链仍可构建。
5. 后续在 qiuye-fe-cli 仓库单独设计并完成 `FOLLOW-CLI-001`。

## 不得违反的约束

- 不合并到 `main`，所有新版 Electron 改动留在 `electron-modern`。
- 未提供签名或等价通知替代方案前，不升级到 Electron 42+。
- 保留系统通知、更新检查、macOS/Windows titlebar、窗口按钮与拖拽热区。
- 固定 `packageManager: pnpm@8.7.0`，依赖命令只使用 `corepack pnpm`。
- qiuye-ui 平滑圆角必须保留标准 `border-radius` 回退和 `@supports` 增强规则。
- 不迁移模板边界外的业务功能。
- 本次启动的前端/Electron dev 服务必须在回答前停止。

## 实施记录模板

```markdown
# 工作包 <ID>：<标题>

## 基本信息

- 日期：
- 状态：已完成 / 部分完成 / 阻塞
- 对应执行计划工作包：

## 本次实现内容

-

## 修改文件

-

## 接口或数据结构变化

-

## 验证结果

执行命令：

```text

```

结果：

-

## 未完成事项

-

## 下一步建议

-
```
