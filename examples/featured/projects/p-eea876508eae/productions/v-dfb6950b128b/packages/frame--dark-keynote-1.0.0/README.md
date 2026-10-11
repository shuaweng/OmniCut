# 空间发布会

纷乱界面一按归位，光扫揭幕与数字亮相，最后收成一根光标。完整时长 42 秒，也可按原片时间裁取片段。

这个 Author Package 保留 Lemo 的 **Room to Think** 全部 Canvas 场景、264 个对象、2.5D 相机、120 BPM 时间表和原缓动。默认 Tidy、青柠色和字幕用于原片对照；品牌名、强调色、字幕与片段起点可编辑。内部始终按 1920×1080 绘制，输出在目标画布中等比适配；竖屏会留出背景区域，不自动重新构图。

## 原生用法

安装本包后，按实际包目录声明三个原字体，`font` 引用工程已有的中文字体作为 fallback：

```xml
<import as="motion" from="@frame/dark-keynote@1"/>
<asset:Font id="inter" src="./packages/dark-keynote/fonts/Inter.ttf" weight="400" style="normal"/>
<asset:Font id="interTight" src="./packages/dark-keynote/fonts/InterTight-var.ttf" weight="400" style="normal"/>
<asset:Font id="mono" src="./packages/dark-keynote/fonts/JetBrainsMono-var.ttf" weight="400" style="normal"/>
<asset:Font id="font" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>
<motion:Motion id="launch" timeline={program.timeline} canvas={canvas}
  font={font} inter={inter} interTight={interTight} mono={mono}
  start="0s" end="42s" brand="Tidy" accent="#B7F34A" captions="true"
  sourceStart="0" rate="1" z="50"/>
<film:Track source={launch.track}/>
```

这是 Motion 元素及字体声明片段，使用工程已有的 `asset`、`film`、`program`、`canvas` 等声明。包目录可能由安装器命名为带版本的目录，字体 `src` 应对应实际安装路径。

`start/end` 是成片上的时段。`sourceStart` 是源场景起点秒数，`rate` 默认 1；源时间为 `sourceStart + localFrame / fps × rate`，超出原 42 秒后停留在最后边界帧。保留原节奏时不要改 `rate`。例如成片 0–4.5 秒使用「冻结与归位」：`start="0s" end="4.5s" sourceStart="15" rate="1"`。

`package.json` 的 `frame.segments` 给出六段推荐窗口：界面积累 0–15s、冻结归位 15–19.5s、产品光扫 19.5–24.5s、数字揭示 24.5–29.5s、收起成光标 29.5–33s、回响结束 33–42s。任意切点仍是原时间函数，不会重新启动对象生成或相机编排。

品牌最多 8 个字符；文字与图标仍是此日历/桌面整理示例。改为其他品牌时会隐去原示例片尾的自我介绍卡，保留光标回响，作者版权继续留在源码与许可文件中。要更换故事、标题、界面业务或原数字，应修改 `source/` 中相应场景，再打包，不能只改品牌就声称适配了任意产品。

## 源码、字体与重建

- 来源：`lemomo-ai/lemo-opuscar`，固定 commit `a75e2b3384cded87955c8743b5a59db06ea491a8`，`styles/dark-keynote/demo`。
- `SOURCE.json` 记录 17 个保留文件的 SHA-256 与固定源码链接；原始 `film/world/engine/timeline/core/lib` 文件保持不变，便于 Agent 阅读和修改。
- `source/adapter.js` 将原场景接到同步 `browserProgram`，按局部帧寻帧，无 `fetch`、自动播放或全局 `window.render`。
- `build-scene.mjs` 只用已安装的本地 esbuild 生成 `scene.js`，不执行上游 setup、Skill、TTS、音乐生成或安装命令。Agent 改了 `source/` 后优先按 use 返回的 `localBuild.arguments` 调用 `rebuild_motion_component`，成功后 commit/preview；直接改公开参数不需重建。终端手动重建可在实际包目录运行 `node build-scene.mjs`；它先使用 `FRAME_ESBUILD_PATH` 或正常模块解析，再沿包目录与当前目录的祖先检查 `node_modules`、视频引擎的 pnpm 缓存和 `.hypit-state` 缓存，因此安装到 workspace 后也能重建。需要覆盖时，用 `FRAME_ESBUILD_PATH` 指向已有的 esbuild 包目录或 `esbuild/lib/main.js`，不会自动下载或安装。
- 原字体为 Inter、Inter Tight、JetBrains Mono。原 assets 归档缺少其 CSS 指向的 Inter Tight woff2，本包使用 Google Fonts 官方 Inter Tight variable ttf，并附对应 OFL。不能声称这个替代字体文件与归档原文件逐字节相同。
- 原生字体节点负责登记资源；适配器获取实际字体族名，启用变量字体范围，再用 Canvas 绘制。中文通过工程 `font` fallback。捕获必须在原生 provider 等待 `document.fonts.ready` 后重新取帧，避免首次绘制使用 fallback。
- 为确保重复/反向/跳跃寻帧，适配器每帧重置输出和离屏缓冲；这些实例数据不会在两个 Motion 节点之间共享。

## 许可和原片音轨

本包场景源码为 MIT，见 `LICENSE`。字体为 SIL OFL，见 `fonts/OFL-*.txt`。原作者署名、完整片尾内容与参考来源保存在 `source/`、`SOURCE.json` 和 `CREDITS`；源代码分发必须保留许可。

`audio/reference-mix.wav` 和 `audio/reference-score.wav` 是原片声画对照材料，默认 Motion 只生成画面，**不自动添加音轨**。旁白、音乐采样及合成声音的独立许可见 `CREDITS`。修改品牌、场景文案或节奏时应重新处理声音，避免把原旁白直接套到新产品。

本地打包和包级检查不代表已通过像素保真验收；关键帧、字体、片段寻帧及原片声画对照由隔离的原生预览流程验证。
