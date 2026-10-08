# PotSubOverlay 最终设计

## 结论

PotSubOverlay 是一个 Windows 11 桌面工具：读取 PotPlayer 正在播放的文件与进度，自动加载同路径同名的外挂字幕，在游戏等全屏应用（无边框窗口模式）之上以透明、置顶、鼠标穿透的字幕条显示。基于 `qiuye-electron-template` 的 `electron-modern` 分支（Electron 41 / Chromium 146 / React 19 / Tailwind 4 / shadcn + qiuye-ui / motion）。

## 已验证的技术前提（2026-10-07 实测）

| 能力 | 方式 | 结果 |
|---|---|---|
| 枚举 PotPlayer 实例 | `EnumWindows` + `GetClassNameW`，类名 `PotPlayer64` / `PotPlayer` | 可用 |
| 总时长 / 当前位置 / 播放状态 | `SendMessageTimeoutW(hwnd, WM_USER, 0x5002/0x5004/0x5006)` | 毫秒值；状态 2=播放；单次约 23µs |
| 当前文件完整路径 | `PostMessageW(hwnd, WM_USER, 0x6020, 我方HWND)`，PotPlayer 回发 `WM_COPYDATA`（`dwData=0x6020`，UTF-8） | 中日文 / 网络盘路径正确 |
| 在 Electron 中调用 Win32 | `koffi`（Node-API，预编译 `@koromix/koffi-win32-x64`，无需重编译） | Electron 41 可用 |
| 接收 `WM_COPYDATA` | `BrowserWindow.hookWindowMessage(0x4A)` + `koffi.decode` 解引用 `COPYDATASTRUCT` | 可用 |

取路径必须用 `PostMessage`（异步）而不是 `SendMessage`：后者会在 koffi 同步调用期间重入主线程消息处理，风险高。多个实例的路径请求串行化（同一时间只有一个未完成请求，300ms 超时）。

## 目标

1. 自动发现所有 PotPlayer 实例，默认跟随“正在播放”的实例，也可手动指定。
2. 自动发现同名字幕：`.srt / .ass / .ssa / .vtt / .lrc`，支持 `名字.ja.srt`、`名字.scjp.ass`、`名字.mp3.vtt` 等变体；自动识别编码（UTF-8/16、GBK/GB18030、Shift-JIS、Big5、EUC-JP）。
3. 双语两行：单文件双语与两个单语文件合并均支持；默认中文在上；可切换“双语 / 仅中文 / 仅日文”；语言识别基于假名 + 文件内位置/样式学习。
4. 字幕条透明、置顶、鼠标穿透、不抢焦点；编辑模式下可拖动定位、调宽度，位置按显示器比例保存。
5. 控制面板现代、简洁、流畅：完整模式 + 简洁（迷你）模式；托盘常驻；全局快捷键；中/繁/英/日四语。
6. GitHub 公开仓库 + Actions 自动构建 Windows 安装包。

## 非目标（第一版）

- 不做 ASS 完整特效渲染（定位、卡拉 OK、绘图），只取对白文本。
- 不支持 PotPlayer 之外的播放器（保留 `PlayerAdapter` 抽象以便扩展）。
- 不覆盖独占全屏游戏（系统层面不可行，文档中说明改用无边框窗口）。
- 不考虑 macOS / Linux。

## 架构

```text
electron/main/
  index.ts                 应用装配：单实例、窗口、托盘、服务连线
  win32/user32.ts          koffi 绑定（EnumWindows/GetClassNameW/GetWindowTextW/SendMessageTimeoutW/PostMessageW/GetForegroundWindow…）
  player/potplayer.ts      PotPlayer 适配器：实例发现、进度轮询、路径请求队列
  player/monitor.ts        PlayerMonitor：活动实例选择（自动/手动）、播放状态快照
  subtitle/*               字幕发现、解码、解析、语言识别、时间轴查询（纯 TS，可单测）
  session.ts               SubtitleSession：媒体变化 → 扫描/加载轨道 → 按时间产出显示行
  settings.ts              JSON 设置持久化（userData/settings.json），变更广播
  windows/control.ts       控制面板窗口（Mica、隐藏标题栏、完整/简洁模式）
  windows/overlay.ts       字幕窗口（透明、置顶、穿透、编辑模式）
  tray.ts / hotkeys.ts     托盘菜单、全局快捷键
  ipc.ts                   IPC 合约
electron/preload/
  index.ts                 控制面板 preload（沿用模板 loading）
  overlay.ts               字幕窗口 preload（无 loading）
src/                       控制面板 React 应用
src/overlay/               字幕窗口 React 入口（overlay.html）
src/shared/                主进程与渲染进程共享的类型与默认值
```

### 数据流

1. `PlayerMonitor` 每 1s 枚举实例；活动实例播放中每 50ms 轮询位置（暂停 250ms）。窗口标题或时长变化时重新请求路径。
2. 媒体路径变化 → `SubtitleSession` 扫描目录、解析候选字幕、按规则默认启用轨道，并 `fs.watch` 目录（失败忽略，提供手动“重新扫描”）。
3. 每次位置更新 → 计算当前显示行（应用每文件时间偏移）→ 仅在内容变化时推送给字幕窗口。
4. 控制面板以约 8Hz 接收状态快照（进度、实例、轨道、当前行）。

### 字幕模型

```ts
type Lang = "zh" | "ja" | "other";
interface Cue { start: number; end: number; lines: { text: string; slot: string }[] }
interface Track { id; path; format; tagLangs; cues; langProfile: { langs: Lang[]; bilingual: boolean } }
```

- `slot`：ASS 用样式名；其他格式用“行在 cue 内的序号”。
- 语言识别：含假名 → `ja`；仅汉字 → 待定；拉丁 → 待定。对每个 slot 统计确定行的多数语言（≥70%）后回填待定行；整个轨道确定行 ≥85% 为同一语言时视为单语轨道。文件名标记（`ja/jp/jpn/chs/cht/sc/tc/scjp/…`）优先于统计。
- 默认轨道选择：存在双语轨道 → 选最佳一个（简体优先，ass > srt > vtt > lrc）；否则选最佳中文 + 最佳日文合并；否则选最佳一个。
- 归一化：去除空白行；识别 YouTube 滚动字幕（行首重复上一条末行、≤20ms 过渡 cue）并去重；LRC 同时间戳合并、结束时间取下一时间戳（上限 10s）、支持 `[offset:]`；ASS 去除 `{\…}` 标签、`\N` 拆行、默认过滤含 `\pos/\move/\p1` 的特效/屏幕字。

### 字幕窗口

- 普通模式：窗口 = 字幕区域（宽度为显示器宽度比例，高度按字号计算），底部锚定于保存的位置；`setIgnoreMouseEvents(true)`、`focusable:false`、`alwaysOnTop('screen-saver')`，可见时每 3s 重申置顶。
- 编辑模式：窗口扩展到整块显示器、可交互；暗色背景 + 中线吸附参考线 + 可拖动字幕块 + 宽度手柄；Esc/完成退出。切换时先淡出、改尺寸、再淡入，避免错位闪帧。
- PotPlayer 处于前台时自动隐藏（默认开启），避免与播放器内字幕重复；可选“暂停时隐藏”。
- 渲染：`-webkit-text-stroke` + `paint-order: stroke fill` 描边，柔和阴影，可选半透明底板；行切换用 motion 做轻量 opacity/blur 过渡（可关闭）。

### 控制面板

- 完整模式（约 960×680）：底部胶囊导航 —— 播放（实例、字幕轨道、语言模式、偏移、实时预览）/ 外观（字体、字号、颜色、描边、阴影、底板、动画，带实时预览）/ 设置（快捷键、行为、开机启动、主题、语言、更新）/ 关于。
- 简洁模式（约 380×196，可置顶）：当前文件、状态、进度、当前字幕预览、显示开关、语言模式、编辑位置、偏移微调、展开按钮。
- 关闭窗口 = 隐藏到托盘；托盘菜单提供显示/隐藏字幕、编辑位置、语言模式、退出。

### 默认快捷键

| 功能 | 默认 |
|---|---|
| 显示/隐藏字幕 | `Ctrl+Alt+S` |
| 编辑字幕位置 | `Ctrl+Alt+P` |
| 切换语言模式 | `Ctrl+Alt+J` |
| 字幕提前 0.5s | `Ctrl+Alt+[` |
| 字幕延后 0.5s | `Ctrl+Alt+]` |

## 环境与工具

- Node.js 24（项目专用便携版，位于 `%LOCALAPPDATA%\PotSubOverlay-tools`，不改全局）；pnpm 8.7.0 via corepack。
- 新增依赖：`koffi`、`iconv-lite`、`chardet`；测试使用 `vitest`。
- 打包：electron-builder NSIS x64，仅保留 koffi 的 win32-x64 二进制并 `asarUnpack`。

## 风险

| 风险 | 对策 |
|---|---|
| PotPlayer 未来改动消息接口 | 适配器隔离；失败时 UI 明确提示 |
| 游戏自身也置顶 | 定时重申置顶；文档说明使用无边框窗口 |
| 网络盘 `fs.watch` 不可靠 | 捕获异常，提供“重新扫描”按钮，媒体切换时总会重新扫描 |
| 纯汉字日文行误判为中文 | slot 多数投票 + 文件名标记 + 手动指定轨道语言 |

## v1.1：通用双语（主语言 + 第二语言）

v1.0 把双语写死为“中文 + 日文”。v1.1 改为按“角色”工作，不假设具体语言组合。

### 支持的语言

`zh` `ja` `ko` `en` `fr` `de` `es` `pt` `it` `ru` `th` `vi` `ar`，其余记为 `other`。语言表（显示名、HTML lang、默认字体栈、示例文本）集中在 `src/shared/languages.ts`，主进程与渲染进程共用。

### 识别

- 按文字系统分类：假名 → `ja`，谚文 → `ko`，西里尔 → `ru`，泰文 → `th`，阿拉伯 → `ar`，越南语特有字母 → `vi`，汉字（含中文专用字）→ `zh` / 待定，拉丁字母 → 待定。
- 拉丁字母行按 slot 汇总后用高频功能词打分区分 `en/fr/de/es/pt/it`，没有把握时默认 `en`。
- 仍按 slot（ASS 样式 / 行序）投票回填待定行；≥2 个有效 slot 语言不同即为双语。
- 文件名标记扩展到全部语言，并能拆分连写组合：`scjp`、`chseng`、`zhen`、`简英`、`中日双语` 等。

### 角色

- 设置 `primaryLang`（默认 `zh`）。当前字幕包含主语言时它就是“主语言”，否则取出现的第一种语言；“第二语言”为另一种语言。
- `langMode`：`both` / `primary` / `secondary`；`langOrder`：`primary-first`（默认）/ `secondary-first`。
- 外观按角色设置：`style.primary` / `style.secondary` 各自的字体（空 = 按语言自动）、字号、字重、颜色；取消 `secondaryScale`。
- 默认轨道选择：优先包含主语言的双语文件；否则“主语言最佳文件 + 另一语言最佳文件”；再否则任意最佳文件。
- 设置文件升级到 `version: 3`：自动迁移 v1 的 `zh/ja` 样式与模式；仍是 1.0 默认值（34px / 25px / 3px 描边）的项改为新默认值（30px / 24px / 1.5px），用户改过的值保持不变。

## v1.2：游戏中不切出去

目标：游戏进行中不需要 Alt+Tab 回 PotPlayer 或控制面板，也能控制播放、找回漏看的字幕，并让字幕位置适配不同游戏的界面。调研过程见 `docs/TODO.md`。

### 播放控制

- 新增 `PlayerBridge.seek / setPlaying / command`，PotPlayer 实现为 `PostMessage`：`WM_USER 0x5005`（跳转，毫秒）、`0x5007`（1 暂停 / 2 播放）、`WM_COMMAND 10787`（下一关键帧，ID 取自 `PotPlayer64.dll` 菜单资源）。只发给当前跟随的实例。
- 快捷键（`HOTKEY_GROUPS.playback`）：播放 / 暂停 `Ctrl+Alt+K`、重听这一句 `Ctrl+Alt+Down`、后退 / 前进 `Ctrl+Alt+Left/Right`（`seekStepMs`，默认 5000）。`Ctrl+Alt+Space`、`Ctrl+Alt+R` 在开发机上已被占用，不作默认值。
- 重听：目标 = 当前句开始时间（`lineAt`，多个单语文件取最早开始的一条）+ 本文件偏移 − 200ms；当前没有字幕时用上一句（`lineBefore`）。1.5s 内再按，从上次的目标句往前一句，而不是从尚未刷新的播放位置计算。
- 后退 / 前进：1.2s 内连按在上次目标上累加；不越过 `时长 − 1s`。
- 跳转落点检查（`checkSeekLanding`，每次轮询调用，3s 超时）：PotPlayer 跳转期间返回的读数不可靠（旧位置冻结或继续走、请求的时间本身、临时的 0、状态“已停止”），这些读数视为“未完成”，期间继续显示目标位置的字幕；第一个可靠读数即落点：
  - 视频文件落点比目标早 800ms 以上 → `keyframeSeek = true`（换文件前保持），设置页提示关闭「以关键帧定位」；音频扩展名不参与判断。
  - 前进时落点比起点前进不到半个步长（且目标本身足够远）→ 补发「下一关键帧」。
- 反馈：主进程发 `overlay:toast`，字幕窗口在顶部显示约 1.3s 的提示胶囊。PotPlayer 的 `0x6040` OSD 不用，因为游戏时看不到 PotPlayer 画面。
- 轮询：读取位置的 `SendMessageTimeout` 由 200ms 改为 80ms，位置无响应时不再查询状态；播放中单次读到 0 视为误读（连续两次才接受）。

### 回看与最近字幕

- `subtitle/lines.ts`（纯函数，可单测）：`lineAt`、`lineBefore`（开始时间相差 ≤250ms 的 cue 视为同一句，适配两个单语文件）、`linesBefore`（按当前语言模式合成，跳过空句与重复句）。
- 回看 `Ctrl+Alt+Up`：`overlay:recall` 推送 `{ display, depth }`，字幕窗口以 0.82 倍字号、带「上一句 / 前 N 句」标签显示在当前字幕上方 5s；5s 内再按 depth + 1。字幕窗口高度增加 `recallReserve(style)`，窗口透明且鼠标穿透。
- 快照新增 `history`（最近 5 句，含当前句，按行缓存），播放页「最近字幕」列表点击后 `player:play-line` 从该句播放。

### 按程序的字幕位置

- `ForegroundTracker`（300ms 轮询）：前台窗口 → 进程 → `QueryFullProcessImageNameW` 得到小写 exe 名；PotPlayer 实例、本应用进程和系统界面（explorer、开始菜单、搜索等）不改变“当前程序”，所以 Alt+Tab 到这些窗口时保持游戏的位置。读不到的进程（受保护进程）记为 null，使用默认位置。
- 设置：`placementProfiles: Record<exe, { placement, touched }>`（最多 100 个，单独持久化，不走 `mergeKnown`）、`autoPlacement`（默认开）。生效位置 = `autoPlacement && profiles[当前程序]` ? 该位置 : `placement`。
- 编辑模式进入时固定编辑对象 `editApp`（当时的当前程序）；工具栏下方「用于：所有程序 / xxx.exe」。切到 xxx.exe 即以当前草稿创建该程序的位置，切回所有程序即删除；拖动、微调、恢复默认都保存到当前选择的对象。
- 设置页「按程序的字幕位置」列出各程序的位置并可删除，标出正在使用的一项。

### 字幕窗口高度

- 窗口底边 = 设定位置；高度在上方空间不足时缩短，而不是被屏幕上沿推下来（修复字幕放在顶部附近时比设定位置低的问题）。

### 文字与描边不透明度

- `style.primary.opacity` / `style.secondary.opacity`（默认 1）与 `style.outlineOpacity`（默认 1），旧设置由 `mergeKnown` 补上默认值，无需迁移。
- 描边是居中的 `-webkit-text-stroke`、画在文字下面，有一半在字形内部：文字不透明时被盖住，半透明时会透出来。只有“描边 > 0 且文字半透明”时改走 `SubtitleView` 的 `SplitFilter`：文字画成纯红、描边画成纯绿，SVG 滤镜按 `通道 + alpha − 1` 拆出文字与描边两层，各自上色和设置不透明度；阴影改用作用于结果的 `drop-shadow`（模糊取一半，与 text-shadow 观感接近）。其余情况沿用原来的 rgba 颜色，默认外观不变。
- 底板与文字分成两个元素，滤镜不会读到底板颜色。
