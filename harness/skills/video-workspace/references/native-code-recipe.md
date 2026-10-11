# 原生代码制作：从可运行包开始

用于补充代码镜头与同一 Film 的接线。已选包的 README、字体声明和实际源码是其接口与设计的依据；完整场景或片段改编沿 motion-direction 的 [源码复用参考](../../motion-direction/references/reuse-authored-scenes.md)，保留原版式与时间关系。下面的品牌揭幕是简单接线例子，只在本镜需要这种表达时采用，不能替代已选完整场景，也不是整片模板。

## 1. 准备一次，沿用返回路径

读取本轮已有 `get_project_context`、目标 videoId 与工程 revision，查看 `main.svml` 的已有 Timeline / Canvas / Film。需要代码文件工具才 `checkout_hypit_project` 一次；已有未提交草稿或 use 已准备包就继续该副本，不重新 checkout。需要找实现时 `list_motion_components` 按镜头意图筛选，`get_motion_component` 读候选 README、原字体及源段落，再用真实 id 调用：

```json
{"componentId":"选中结果的真实id","videoId":"当前真实videoId"}
```

`use_motion_component` 已复制包、链接本地依赖，返回 `starter` 与真实路径。starter.emptyDraft.files 是所选包可编译的 Film/SVS，starter.merge 是保留旧影片的接线；starter.editable 给公开改稿入口，window 明确源片段与影片窗口，audio 提供同一 Film 的声音接法。新空白稿用 initializeDraft:true 可直接写好最小 Film，不提交；下一步 commit→preview。先读当前 main.svml/look.svs 后使用这些接线与公开参数，不必重读包注册、全部原片模块或 vocabulary；未公开内容再读对应源码。返回值的真实含义：

| 字段 | 用途 |
| --- | --- |
| `workspaceDirectory` | 本视频工程的绝对根，读写 `main.svml` / `look.svs` 用这里 |
| `absoluteDirectory` | 包的绝对目录；`sourcePaths` 列出其入口、渲染与原场景文件的真实读取路径 |
| `directory` | 如 `hypit/packages/frame--brand-reveal-1.0.0`，是兼容相对路径，不再拼到绝对根后面 |
| `revision` | 当前已保存工程版本；提交使用这个基线，不能猜版本 |

保留原 `render.svrun`、运行时配置和 `package.json` 的其他依赖；工具已经添加所选包的本地依赖，无需安装 npm 包、第三方 skill 或渲染器。加入包后不要再次 checkout 覆盖草稿。

恢复任务或重启运行进程后，历史聊天里的读取记录不等于本轮文件工具的读取状态。修改已有 `main.svml`、`look.svs` 或组件源码前，先读要改的那几个文件；不要生成整份替换内容后才遇到“文件未读取”。这一步用于确认当前草稿，不是重读框架文档。

## 2. 简单品牌揭幕接线示例

仅当选中 `frame--brand-reveal@1.0.0` 时，下面的 Reveal、属性与单字体才适用。其他组件按实际 README 替换 import / Surface / 输入和输出，完整场景还需其原字体及源时间参数。已有工程新增对应 import、实例和 Film 内的 Track，引用现有 Timeline / Canvas，保留已有镜头与音轨。下面是品牌揭幕在空白 draft 的最小 3 秒 Source；字体是 checkout 返回的真实文件：

```xml
<?svml using="@hypit/markup@1"?>
<svml>
  <import as="time" from="@hypit/timeline-author@1"/>
  <import as="space" from="@hypit/spatial@1"/>
  <import as="asset" from="@hypit/media@1"/>
  <import as="film" from="@hypit/film@1"/>
  <import as="render" from="@hypit/render-hyperframes@1"/>
  <import as="look" source="./look.svs"/>
  <import as="reveal" from="@frame/brand-reveal@1"/>
  <time:Clock id="clock" frame-rate="30"/>
  <time:Timeline id="program" clock={clock} end="3s"/>
  <space:Canvas id="canvas" width="540" height="960"/>
  <asset:Font id="font" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>
  <reveal:Reveal id="opening" timeline={program.timeline} canvas={canvas} font={font}
    start="0s" end="3s" eyebrow="用户品牌" title="当前镜头的核心表达"
    subtitle="需要时才写副标题" background="#171615" color="#f8f0e6" accent="#ee8654"/>
  <film:Film id="main" canvas={canvas} timeline={program.timeline} appearance={look.film.main}>
    <film:Track source={opening.track}/>
  </film:Film>
  <render:Video id="final" composition={main.composition} timeline={program.timeline}/>
</svml>
```

空白工程的 `look.svs` 对应：

```xml
<?svml using="@hypit/svs@1"?>
<sheet version="1">film.main { background: #171615; }</sheet>
```

普通改稿只改调用方的 `eyebrow/title/subtitle/background/color/accent/z/start/end`。设 `transparent="true"` 可在实拍之上点题，`z` 高于底片的 `stack-order`；不把每段素材都替换为不透明品牌页。空字符串可去掉不需要的品牌或副标题。

## 3. 同一 Film 接实拍底片与代码叠加

已有素材的 `editing.document` 是现成 Source：用返回的 `editing.importFrom` 导入，视频引用该别名的 `.prepared.media`；图片引用 `.asset` 并给真实尺寸 Extent。不要为已准备的素材重复 stage/sync/Normalize，先核对其 `editing.frameRate` 与当前 Clock 一致。

下面只示范新增片段，路径用实际返回值替换。已准备媒体叫 `footage` 时：

```xml
<import as="footage" source="./实际editing.document路径"/>
<import as="media" from="@hypit/media-track@1"/>
<space:Frame id="full" within={canvas} left="0%" top="0%" right="100%" bottom="100%"/>
<media:Track id="base" timeline={program.timeline} canvas={canvas}>
  <media:Item id="live-shot" media={footage.prepared.media} frame={full}
    start="3s" end="17s" appearance={look.media.live}/>
</media:Track>
<reveal:Reveal id="point" timeline={program.timeline} canvas={canvas} font={font}
  start="5s" end="8s" transparent="true" z="50"
  eyebrow="" title="当前画面的点题" subtitle="" color="#ffffff" accent="#ee8654"/>
```

在现有 `look.svs` 的 sheet 内加 `media.live { stack-order: 0; fit: cover; playback: once-start; }`，在**同一个** Film 内加入 `<film:Track source={base.visual}/>` 与 `<film:Track source={point.track}/>`。Media Track 输出 `.visual`，Reveal 输出 `.track`，不能互换。示例底片至少要有 14 秒可用区间；素材不足时按真实取段方案改窗口，不靠延长窗口或图片缩放冒充运动。

原声按剪辑目的保留：素材实际有音轨且该段需要它，给 Item 加 `source-audio="content"`，再将 `<film:Track source={base.audio}/>` 接入 Film。无音轨时不引用 `.audio`。已有旁白/音乐轨继续保留，不重复叠加同一原声。新底片需要 Normalize 时才声明 `asset:Video` 并 `pipeline:Normalize source={素材id} clock={clock} video="primary-moving" audio="default" span-authority="video"`，输出 `.media`；没有音轨选 `audio="none"`。

### 同一 Film 的独立配乐

包内参考配乐或本地剪好的 WAV 必须真正进入 Film；存在素材库、发布素材或画面预览不代表成片有声。先把选中的本地声音 `publish_workspace_asset` 入库，再按真实 revision 用 `edit_audio_track(action="add",role="music")` 接入已有工程。后续移动或换声仍沿同一条音轨；不要重复添加。

需要直接写原生源码时，`@hypit/audio-track@1` 的 Surface 是 `Track`；`Item` 是 Track 的子元素，单查 `vocabulary --tag Item` 得到空 Surface 不表示没有这个能力。官方接法如下，替换实际音频路径、影片时长与混音参数，复用当前 Clock / Timeline：

```xml
<import as="pipeline" from="@hypit/media-pipeline@1"/>
<import as="audio" from="@hypit/audio-track@1"/>
<asset:Audio id="score-source" src="./assets/实际音频文件.wav"/>
<pipeline:Normalize id="score-media" source={score-source}
  video="none" audio="default" span-authority="audio" clock={clock}/>
<audio:Track id="music" timeline={program.timeline}>
  <audio:Item id="music-clip" source={score-media.media} at="0s" for="15s"
    playback="once" gain="0.9" fade-in="0.1s" fade-out="0.5s"/>
</audio:Track>
```

在现有同一个 Film 内加入 `<film:Track source={music.audio}/>`。需要取源片段才设 `trim-start / trim-end`，源结束不含；不能把素材或 `.media` 直接当 AudioTrack。已单独加淡入淡出或剪成目标时长的音乐按实际目的设置，不重复处理。图像预览的小样静音，最终以导出文件的真实音轨及试听验收。

## 4. 复用当前包的 Companion，小步改行为

上面的 brand-reveal `activation.js` 已含 producer、Markup Surface 和 `createStudioTrackCompanionHostFacet`。它的标题、副标题、品牌、三种颜色与 z 有可写 binding / inspector，window 有原生时间谱系；`transparent` 是 Source 参数，旧包没有对应面板控件。其他包按自己的 README/activation 与 Inspector 确认控件，不推定接口相同。修改调用方后检查相关真实控件，无需重建现有 Companion。

未公开的内容或现有动画不能表达本镜头时，先读实际相关源码，再改该文件；品牌揭幕可调整 `.content/.title/.halo`，完整场景则保留其原 HTML/CSS/Canvas、easing、字体与摄影关系，在实际原模块或数据表改编。保留 `browserProgram → sealVisualTrack`、字体输入和绝对帧求值，不用墙钟、累积计时或播放状态。新增用户可调位置/尺寸/行为时同步 Surface、config、binding 与 inspector；只改 CSS 不等于公开参数。复用现有注册方式，复杂新类型才查对应文档。项目副本可继续改，保存改编为库组件前更新包版本与 README，避免覆盖已有库版本。

若另建或重命名包，需要在**工程根** `package.json` 的 `dependencies` 声明本地引用，例如 `"@omnicut/silver":"file:./packages/omnicut--silver-1.0.0"`，与包的 `name` 和 Source import 对齐。提交工具会按这些 `file:` 依赖链接工程内的包；仅写出 `packages/` 文件夹不会注册新包，不要靠 npm 下载或手动改引擎来解决“cannot resolve installed package”。

## 5. 提交第一版，依据画面继续

接线与文案完成就 `commit_hypit_project`，使用正确 videoId 和当前基线 revision；成功已包含编译检查，无新改动不再重复 check/validate。随后 `preview_frames` 选进入、运动中、落稳的真实时间，例如 `times:[0,0.6,1.4,2.7]`，可加 `sampleDuration:3` 看短动作；项目小样静音，不能作为声音验收。已有长片只预览本次修改的时间点。修正具体问题后再提交，达到镜头目的即可继续其余镜头，不用反复抽帧替代制作。整片完成后再 export / probe / 审片。

只有未建立的接口或实际错误才查一次精准 vocabulary，`run_hypit_tool.args` 是 JSON 字符串，例如 `"[\"vocabulary\",\"@hypit/media-track\",\"--tag\",\"Track\"]"`。媒体常用查法：

- `vocabulary @hypit/media --tag Video`：文件 BlobArtifact，引用元素自身 `{素材id}`。
- `vocabulary @hypit/media-pipeline --tag Normalize`：Blob → `.media`，选流与 Clock。
- `vocabulary @hypit/media-track --tag Track`：含 Item 子元素、appearance/trim/playback 与 `.visual/.audio`；Item 没有 raw `video=`，也不是独立 Surface。
- `vocabulary @hypit/spatial --tag Frame`：`within/left/top/right/bottom`，不是猜 `x/y/width/height`。
- `vocabulary @frame/brand-reveal --tag Reveal`：包安装后才可查；以上接口已足够时不重复查询。

CLI 使用 `--tag`，没有 `--surface`。Media 的 source trim 在 SVS Recipe 中是成对整数帧 `trim-start/trim-end`（结束不含），不把秒或 Item 的 start/end 混进来。`frame-x/frame-y` 是素材在目标 Frame 内的对齐比例，不是 Canvas 坐标；先用明确的 Frame 放画面。只读不了解的那一个接口，随后回到源码修改。
