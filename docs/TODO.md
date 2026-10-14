# TODO

后续考虑实现的功能。动手前先在这里补充调研结论，确定后再写入设计文档与执行计划；完成后从本文件移到 CHANGELOG，调研记录归档到 `docs/开发设计文档/potsuboverlay_research/`。

## 暂缓：支持 PotPlayer 以外的播放来源

除 PotPlayer 外，接入 mpv、MPC-HC / MPC-BE、VLC 等播放器或其他播放来源。

调研状态：**可行，暂不实现**（2026-10-09 决定：PotPlayer 已基本够用）。结论见下方「调研记录 2026-10-09」，重新启动时从那里开始。

## 调研记录

### 2026-10-09：其他播放来源——可行，暂不实现

**结论**：mpv 和 MPC-HC / MPC-BE 都能做到与 PotPlayer 相当的体验（完整路径、毫秒进度、跳转与播放控制）；VLC 能做但进度精度差；SMTC、浏览器、媒体服务器等来源拿不到文件路径或精度不足，只适合降级支持。本轮只做了资料调研，下表中的协议细节**均未实测**，实现前需逐个装机验证。

**一个来源要满足的条件**（对照 `PlayerBridge`）：

1. 当前文件的完整路径（用来找同名外挂字幕；拿不到就只能手动选字幕）
2. 毫秒级播放进度与播放状态（现在每 50ms 轮询一次）
3. 控制：跳转、播放 / 暂停、下一关键帧 / 逐帧（重听、前后跳依赖它们）
4. 区分多个实例，并能拿到播放器进程的 pid（前台程序识别要忽略播放器）

**候选来源**：

| 来源 | 接入方式 | 路径 | 进度精度 | 控制 | 用户需要的设置 | 评价 |
|---|---|---|---|---|---|---|
| mpv（含 mpv.net 等 mpv 前端） | JSON IPC 命名管道，读 `path` / `time-pos` / `pause` / `duration`，可 `observe_property` 推送 | ✅ | ✅ 亚毫秒 | ✅ seek / pause / frame-step | `mpv.conf` 里加 `input-ipc-server` | 首选：协议公开稳定、能力完整；窗口类名 `mpv` |
| MPC-HC / MPC-BE | 内置 Web 接口（默认端口 13579）：`/variables.html` 给 filepath、position(ms)、duration、state；`/command.html` 发 wm_command | ✅ | ✅ 毫秒 | ✅ 播放 / 暂停 / 跳转 / 逐帧 | 在选项里开启 Web 接口（可限本机） | 很推荐：用户多；窗口类名 `MediaPlayerClassicW`；seek 参数格式待验证 |
| MPC-HC `/slave` API | `WM_COPYDATA` 双向消息 | ✅ | ✅ | ✅ | 必须由本应用以 `/slave` 启动播放器 | 不能附着已打开的实例，不采用 |
| VLC | Lua HTTP 接口 `/requests/status.json`、`playlist.json` | ✅（playlist 的 uri） | ⚠️ VLC 3 的 `time` 为整秒，`position` 为比例，需本地时钟插值、在秒跳变时校准 | ✅ seek / pause | 开启 Web 接口且必须设密码 | 能做但同步精度差；想精确要自写 Lua 接口脚本，用户部署更麻烦；VLC 4 精度待查 |
| Kodi | JSON-RPC：`Player.GetProperties`（时间含毫秒）、`Player.GetItem`（文件） | ✅ | ✅ | ✅ | 允许 HTTP 远程控制 | 技术合适，Windows 用户少，优先级低 |
| 系统媒体传输控制（SMTC）：Windows 媒体播放器、电影和电视、浏览器、UWP 应用 | WinRT `GlobalSystemMediaTransportControlsSessionManager` | ❌ 只有标题 | ⚠️ 只给「位置 + 更新时刻」快照，需外推，各应用更新频率不一 | ✅ 视应用支持 | 无 | 覆盖面最广；无路径、精度不稳；Node 调 WinRT 需原生模块或辅助进程 |
| 网页视频（B 站、YouTube 等） | 浏览器扩展读 `video.currentTime`，经本地 WebSocket 推送 | ❌ URL / 标题 | ✅ | ✅ | 安装扩展 | 精度好，但相当于另一个子项目，字幕需手动指定 |
| Jellyfin / Emby / Plex | 服务器 Sessions API | ✅ 服务器端路径 | ❌ 客户端约 10 秒上报一次 | 部分 | 服务器地址与令牌 | 精度太差，不建议；Jellyfin Media Player 内核是 mpv，可能可走 mpv IPC（待验证） |
| KMPlayer、GOM、SMPlayer 等 | 无公开远程接口（SMPlayer 内部 mpv 能否接入待查） | — | — | — | — | 基本做不了，只能看 SMTC 能否覆盖 |
| 手动时钟（不接播放器） | 手动选字幕，快捷键开始 / 暂停，手动对齐偏移 | 手动 | 取决于对齐 | 只控制本应用 | 无 | 万能兜底，实现最简单 |

**若重新启动，需要的架构调整**：

- 实例标识从 `hwnd` 改为通用 `id`，附带 `pid` 和来源类型
- 读进度改为异步（HTTP、命名管道都是异步），最好由 bridge 主动推送 tick（mpv 订阅即推送，PotPlayer 在内部继续轮询）
- 能力声明：有无路径、精度等级、能否跳转 / 逐帧；把 `command(POT_CMD_NEXT_KEYFRAME)` 这类 PotPlayer 专有调用换成语义化的 `stepFrame()` 等，界面按能力隐藏不支持的操作
- 粗精度来源（VLC、SMTC）要有本地时钟插值层，与 `Controller.checkSeekLanding` 的落点判断分开
- 设置页：启用哪些来源、端口 / 密码 / 管道名，连接失败时给出引导
- QA：`POTSUB_FAKE_PLAYER` 能模拟不同来源；操作真实播放器时同样只控制自己打开的测试实例

**建议顺序**：先抽象接口并以 mpv 验证 → MPC-HC / MPC-BE（Web 接口）→ 手动时钟模式兜底 → 视需求再看 VLC、SMTC / 浏览器扩展。
