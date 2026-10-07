# PotSubOverlay 执行计划

## 使用方式

每次实现前读取 `potsuboverlay_final_design.md` 与本文件；完成工作包并验证后更新台账，在 `potsuboverlay_implementation_records/` 写实施记录。

## 状态规则

只使用 `未开始`、`进行中`、`已完成`、`阻塞`、`废弃`。只有实现落地且验证通过才标 `已完成`。

## 进度台账

| 工作包 | 状态 | 完成日期 | 关键文件 | 验证 | 实施记录 | 未解决事项 |
|---|---|---:|---|---|---|---|
| PSO-001 项目初始化与技术验证 | 已完成 | 2026-10-08 | `package.json`; `docs/开发设计文档/potsuboverlay_*` | koffi + PotPlayer 消息实测（位置/时长/状态/路径） | [v1.0.0](potsuboverlay_implementation_records/2026-10-08_PSO-001-007_v1.0.0.md) | - |
| PSO-002 字幕引擎（发现/解码/解析/语言识别/时间轴） | 已完成 | 2026-10-08 | `electron/main/subtitle/*` | vitest 20 项；NAS 上 5 类真实字幕抽样 | [v1.0.0](potsuboverlay_implementation_records/2026-10-08_PSO-001-007_v1.0.0.md) | - |
| PSO-003 PotPlayer 适配与播放监控 | 已完成 | 2026-10-08 | `electron/main/win32/*`; `electron/main/player/*` | 真实 PotPlayer：实例、完整路径、播放/暂停状态 | [v1.0.0](potsuboverlay_implementation_records/2026-10-08_PSO-001-007_v1.0.0.md) | 真实 PotPlayer + 外挂字幕 + 游戏的端到端由用户实机确认 |
| PSO-004 设置持久化、IPC、托盘、快捷键 | 已完成 | 2026-10-08 | `electron/main/*` | typecheck；默认快捷键可注册性探测 | [v1.0.0](potsuboverlay_implementation_records/2026-10-08_PSO-001-007_v1.0.0.md) | - |
| PSO-005 字幕窗口（渲染/穿透/编辑模式） | 已完成 | 2026-10-08 | `electron/main/windows/overlay.ts`; `src/overlay/*` | capturePage 截图（普通/编辑模式） | [v1.0.0](potsuboverlay_implementation_records/2026-10-08_PSO-001-007_v1.0.0.md) | 鼠标穿透与游戏叠加由用户实机确认 |
| PSO-006 控制面板（完整/简洁模式、四语文案） | 已完成 | 2026-10-08 | `src/pages/*`; `src/locales/*` | QA 截图：浅/深色、中/英/日、简洁模式；i18n:check | [v1.0.0](potsuboverlay_implementation_records/2026-10-08_PSO-001-007_v1.0.0.md) | - |
| PSO-007 打包、CI 与 GitHub 发布 | 已完成 | 2026-10-08 | `electron-builder.json`; `.github/workflows/*` | release:dir 打包后运行实测；NSIS 安装包构建 | [v1.0.0](potsuboverlay_implementation_records/2026-10-08_PSO-001-007_v1.0.0.md) | - |
| PSO-008 通用双语（主语言 / 第二语言、13 种语言识别、设置迁移） | 已完成 | 2026-10-08 | `src/shared/languages.ts`; `electron/main/subtitle/*`; `electron/main/settings-migrate.ts` | vitest 26 项；NAS 真实字幕回归（含中英 Zootopia.srt） | [v1.1.0](potsuboverlay_implementation_records/2026-10-08_PSO-008-011_v1.1.0.md) | - |
| PSO-009 自绘托盘菜单 | 已完成 | 2026-10-08 | `electron/main/windows/tray-menu.ts`; `src/tray-menu/*` | QA 截图 | [v1.1.0](potsuboverlay_implementation_records/2026-10-08_PSO-008-011_v1.1.0.md) | 真实托盘右键位置由用户确认 |
| PSO-010 交互修复（简洁模式按钮、显隐闪烁、字体下拉溢出） | 已完成 | 2026-10-08 | `src/components/app/*`; `electron/main/windows/overlay.ts` | elementFromPoint 命中测试；popover 几何测量 | [v1.1.0](potsuboverlay_implementation_records/2026-10-08_PSO-008-011_v1.1.0.md) | - |
| PSO-011 边距对齐（标题栏简洁按钮、主题切换按钮，含模板仓库） | 已完成 | 2026-10-08 | `src/pages/components/*`; qiuye-electron-template `main`/`electron-modern` | DOM 测量：上/右、下/右相等 | [v1.1.0](potsuboverlay_implementation_records/2026-10-08_PSO-008-011_v1.1.0.md) | - |

## 不得违反的约束

- 依赖命令只用 `corepack pnpm`，固定 pnpm 8.7.0。
- 新增文案进入 `src/locales/{zh,zh-Hant,en,ja}/`。
- 保留模板 titlebar、窗口按钮、拖拽热区可用性。
- 本次启动的 dev 服务在回答前必须停止。
- 不修改用户的全局 Node / nvm 配置。
