# 瑞士海报

从 LemoLab 的 Swiss Motion 原片移植完整 Canvas 场景：44秒、1920×1080逻辑画布、120 BPM、精确 Bezier、12栏网格、字体统一/留白/齐左、红圆出走、版面重排、90°旋转乐谱、海报墙与片尾。默认文案、原字体、原曲线和时序保留；没有改成通用色块或淡入模板。原作固定提交及完整源文件见 `source/original/` 和 `CREDITS`。

包是原生 Author Package，输出 `.track` 接到现有 Film；不是把参考 MP4 当模板。逻辑 ABI `@1`、实体版本 `1.0.0`。用 `list_motion_components` 找包，`use_motion_component` 后按返回的实际目录引用字体。默认16:9原构图；其他画幅按 contain 留边，不自动重新设计成竖版。

## 接入同一个 Film

以下路径对应首次复制的 `packages/frame--swiss-poster-1.0.0/`；以 `use_motion_component` 返回的目录为准。`font` 使用项目现有 FrameSans 中文字体，另外三种原字体必须声明，不能用替代字体冒充原效果。

```xml
<import as="swiss" from="@frame/swiss-poster@1"/>
<asset:Font id="archivo" src="./packages/frame--swiss-poster-1.0.0/fonts/Archivo-VF.ttf" weight="400" style="normal"/>
<asset:Font id="fraktur" src="./packages/frame--swiss-poster-1.0.0/fonts/UnifrakturMaguntia-Regular.ttf" weight="400" style="normal"/>
<asset:Font id="serif" src="./packages/frame--swiss-poster-1.0.0/fonts/DMSerifDisplay-Regular.ttf" weight="400" style="normal"/>

<!-- 片内2秒开始，完整播放到46秒；画布/Timeline需容纳这个时段 -->
<swiss:Motion id="poster" timeline={program.timeline} canvas={canvas}
  font={font} archivo={archivo} fraktur={fraktur} serif={serif}
  start="2s" end="46s" sourceStart="0" rate="1"/>
<film:Track source={poster.track}/>
```

native Font 的weight只接受整数；Archivo实际是variable font，包内 `@font-face` 按100–900轴声明，原作各字重正常变化。其他原字体只在“错误字体”与海报墙片段出现，也不能省略。所有字体以真实Blob资源交给渲染器；无大data URI、无网络/CDN、无每帧异步绘制。字体加载完成才做数字测量，使用每次请求的局部帧绘制。

## 选片段做短广告

`start/end` 是成片内位置；`sourceStart` 是原场景内起点；`rate` 默认1保留原tempo。取帧时间为 `sourceStart + localFrame / fps × rate`，支持非0起点、跳转和反向seek。消耗的原场景区间必须在0–44秒内，否则报错，不能悄悄越界或循环。

```xml
<!-- 用原片26–36秒的重排/旋转乐谱，放在广告第5–15秒 -->
<swiss:Motion id="score" timeline={program.timeline} canvas={canvas}
  font={font} archivo={archivo} fraktur={fraktur} serif={serif}
  start="5s" end="15s" sourceStart="26" rate="1"
  accent="#1864d9" posterLine1="新的" posterLine2="节奏"/>
<film:Track source={score.track}/>

<!-- 原片40–44秒的品牌片尾，放在广告第15–19秒 -->
<swiss:Motion id="brand" timeline={program.timeline} canvas={canvas}
  font={font} archivo={archivo} fraktur={fraktur} serif={serif}
  start="15s" end="19s" sourceStart="40" rate="1"
  closingLine1="品牌名字" closingLine2="留下你的节奏" credit="品牌 · 新品发布"/>
<film:Track source={brand.track}/>
```

推荐区间在 `package.json` 的 `frame.segments`：0–4网格开场，4–8构建网格，8–16字体/留白，18–26红圆出走，26–36重排/旋转乐谱，36–40海报墙，40–44品牌片尾。场景本身不透明；保留主画面，上层可再放独立透明文字。切原片是裁取同一故事的片段，不是自动重编所有规则叙事。

## 可编辑参数

| 参数 | 作用 | 默认 |
| --- | --- | --- |
| `accent` | 红圆、红线、播放强调的品牌主色 | `#E30613` |
| `openingLine1/2` | 开场两行标题 | 空值保留原文 |
| `posterLine1/2` | 核心海报标题的两行 | 空值保留neue/musik |
| `closingLine1/2` | 片尾两行标题 | 空值保留原文 |
| `credit` | 片尾品牌署名 | 空值保留原署名 |
| `sourceStart` | 原片起始秒 | 0 |
| `rate` | 播放速率，0.25–2 | 1 |
| `z` | Film图层顺序 | 50 |

中文字符由传入 `font` 回退，文案以加载字体的实际 `measureText` 度量，宽度超出时等比减字号，保留完整文字。建议开场/片尾每行4–12字、海报每行2–6字；超长文字虽然不截断，会缩小影响观感，须检查预览。保留原规则旁白文字与周围小标签，公开参数不声称全文本汉化。修改更复杂故事/网格/镜头请读并改 `source/film.js`、`source/ease.js`，优先按 use 返回的 `localBuild.arguments` 调用 `rebuild_motion_component` 更新 `bundle.js`，再 commit/preview；直接改公开参数不需重建。终端手动重建仍可在实际包目录执行 `node build.mjs`，不会安装任何依赖。保存改编为库组件时再升级实体版本。

复制到工程的 `hypit/packages/…` 后仍可在包目录执行 `node build.mjs`。脚本依次查找普通 `esbuild` 依赖、`FRAME_ESBUILD_PATH`、包目录/当前目录的祖先内已安装node_modules及OmniCut `engines/video` 的pnpm目录、Hypit Host已有运行库。工程完全位于其他目录且没有这些依赖时，可把 `FRAME_ESBUILD_PATH` 设置为已有esbuild模块目录或它的 `lib/main.js`；不是CLI二进制路径。脚本仅使用本地已安装版本，成功时打印实际版本和位置，不自动安装、下载或改全局配置。

## 原声与许可

原代码MIT：保留 `LICENSE` 的LemoLab版权。原字体SIL OFL，各字体许可在 `fonts/OFL-*.txt`。`CREDITS` 记录原配乐/样本/语音许可，Swiss鼓样本包含CC BY 4.0要求；字体及音频不得笼统归为MIT。

`audio/reference-mix.wav` 是含英文旁白的参考原声，`audio/reference-score.wav` 是参考配乐，供原片对照与有明确选择的配乐使用。Motion本身不自动加音轨；改中文/品牌文案不会自动带上原英文旁白，也不会生成新配音。生产工程用现有音轨或另选配音/配乐；需要原声时按实际片段裁音、对齐 `sourceStart/rate`，并保留对应归属。不是把原声写死在渲染器里。

`node --test verify.test.mjs` 检查原作与适配默认的绘制指令一致、随机顺序取帧、字体就绪和中文不截字。真实字体栅格、native Film合成与原片视觉对照另由隔离原生预览验收，不能只用编译通过代替视觉验收。
