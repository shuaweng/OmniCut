---
name: frame-presenter-video
description: 制作有人物口播、全屏/圆窗/半屏切换、产品演示与语义动效的介绍片；复用内置原生组件，贯通配音、人物驱动、字幕和剪辑。用于数字人讲解与产品宣传，不用于纯商品空镜。
---

# 人物讲解片

目标：完成可编辑的人物讲解片。产出：人物素材、真实语音证据与原生工程。完成标准：人物/信息画面与语音一致，关键画面和音轨已有实际检查，成片可播放。

先做创意与人物/声音选角，再按依赖并行生成和搭工程；常用路线复用下方脚本，新接口才查对应文档。底座仍是内置 Hypit 的 Script → SemanticTake → Timeline → Performance / Sound / Caption → Film；图片、音效、音乐、界面演示是同一工程的贡献轨。

## 最短制作路径

1. 从参考提取画面组织（人物何时全屏、何时退到圆窗、屏幕演示哪项操作），交给创意导演一次完整简报。短片旁白先实际朗读估时，留动作与品牌停顿。软件介绍采用真实界面与操作，不带入其他范例文案。
2. 需要新人物时准备原创成人参考；已有角色则复用确认素材。同一人物画面上选择声音。中文优先明确普通话语言/口音的候选；`languageCode=zh` 不代表音色原生普通话。先短句，再整段。没有听觉工具就明确未试听，不把标签当适配结论。
3. 整段 TTS 一次生成并保留字级对齐，`prepare_hypit_speech` 可在空白工程准备；以真实句尾切成当前 videoConfiguration.capabilities 支持的几段，切点落在实词之后的停顿。原证据不可改写来“对上”画面。发布切段后，直接使用工具返回的 `editing.file` / `editing.document`，不用猜路径。
4. 先核对当前视频能力是否支持人物参考与锁定音轨；改选服务/模型用 get_media_capabilities。已接通的口播驱动调用形态为 `generate_video(imageMode=reference_image,audioMode=lock_source,drivingAudioFile=分段配音,autoApply=false)`，provider/model/resolution 沿用用户选择和实际能力。固定机位、克制手势、同一人物参考、不生成文字/音乐。先检查首段实际结果，合格后并行其余人物、连续音乐与组件改编。不要用默认环境音的参考改编工具生成口播。
5. 生成视频实际时长可能多出尾帧。比较返回音轨与驱动音轨的起点/时长，按已确认的叙事时长裁镜头；不要依请求秒数排切点。人物的 SemanticTake 必须含音轨，独立旁白轨不能替代 `media.audio` 契约。

## 可运行起步工程

已有分段人物、声音证据后，写下列 JSON；路径相对 `hypit/`，`duration` 来自该段真实配音，`text` 与配音一致，允许用真实 `@{moment!}` 锚点。

```json
{"fps":30,"width":1080,"height":1920,"segments":[{"id":"opening","text":"做一条广告，素材越剪越乱。","videoFile":"assets/工具返回的文件.mp4","evidenceDocument":"speech/工具返回的证据.svml","duration":5.44,"view":"full"},{"id":"demo","text":"现在，素材都在同一个项目里。","videoFile":"assets/另一段文件.mp4","evidenceDocument":"speech/另一段证据.svml","duration":6.56,"view":"circle"}]}
```

从当前代码工作区运行本 Skill 的 `scripts/assemble.mjs manifest.json hypit/presenter`。脚本只写新目录，用原生 Normalize / Transform / Take / Performance / Sound / Caption 生成 `main.svml`、`look.svs` 和 `render.svrun`；已有同名目录会停止，避免覆盖创作。以返回入口提交 `commit_hypit_project(options={author:"presenter/main.svml",run:"presenter/render.svrun",target:"final.video"})`。这是可编辑的人物骨架，之后把真实界面与动效轨加进 Film，不把骨架冒充完成宣传片。

需要复杂动效参考时 `list_motion_components → get_motion_component → use_motion_component`，加载 motion-direction，读取实际源码并按本片选择源片段。原版完整范例随项目内置在 `engines/video/examples/complex-explainer`：入口 `productions/explainer/authors/main.svml`，`packages/opening-system` 有 PortraitInset / PortraitTransition，`packages/web-scenes` 有协调多素材的帧动画。完整复用原字体、构图、共同时间、activation、Studio Companion 和辅助模块，不重新手写简化近似版；先改调用参数与真实素材，再改需要的内容与布局。参照代码不等于复用原人物或声音。

## 装配时只盯这些契约

- `editing.document` 导入为 `clip` 后，音/视频用 `clip.prepared.media`，图片用 `clip.asset`。返回帧率必须与项目相同；换帧率时可用 `clip.asset` 按项目 Clock 重新 Normalize。裸 `asset:Video/Audio/Image id="x"` 的输出是 `x`，不是 `x.video`。
- 旁白版本、驱动音频、证据文件一起换；保留旧版但不继续引用。使用生成视频音轨时通过 Sound 只播一次；另铺 TTS 时不再把 Sound 加入 Film。换音色需测时序漂移与响度差，不只换文件。
- 媒体跨度与叙事跨度分开。下一段开始时，上一段信息场景就退出；不要让生成尾帧拖长 `during=segment`。品牌画面覆盖到 `program.end`，配乐窗口也绑定该端点。
- Performance 后声明的 Use 覆盖先声明的 Use。常态圆窗在前、短过渡在后。短句字幕保留原语义锚点；字幕分行不等于重排旁白。
- BrowserProgram 的每个 `{{childId}}` 与一个直属 child 一对一。同一媒体出现两处要建两个不同 child；动画读取 `const b=data.beats`；静态 check 不验证浏览器执行。修改组件 JS 后，要观察新预览版本，不能把旧错误当新源码结论。
- 创建音效轨后还要加入 Film；只存在于素材库不等于进入混音。

## 一次完整交付

保存 → 实际预览 → `export_video` → `await_tasks` → `probe_export` → 按需 `stage_export`。使用工具返回的 jobId/file，最终链接不手写或猜路径。关键帧检查人物裁切/烘焙字、信息卡遮挡、真实样片运动、字幕短句、转场与最后一帧；检查音轨与峰值，能试听才评价口音/音色。问题按“时间点—观察—最小修复”记录；已有素材能修就局部修，不重新生成整片。
