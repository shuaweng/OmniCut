# 原生动效接线与绝对帧

用于透明叠层、组件结构修改和新增运动行为。常规 Film/Source 接线沿 `video-workspace/references/native-code-recipe.md`；当前选中组件的 README 是 import、Surface、输出、单位与参数的依据，不从相似包推断全部接口。

## 参数与工程身份

`use_motion_component` 的 `workspaceDirectory` 是工程根，`absoluteDirectory` 是包目录，`revision` 是已保存版本；保留现有草稿，加入包后不再次 checkout 覆盖。工具复制包与本地依赖，不自动把组件 Track 放进影片。读取当前 main.svml、look.svs 和需改的源码后，引用现有 Timeline / Canvas / Font，并把组件实际输出接到已有 Film。

公开参数以 README/activation 为准。目录 parameters 是快速选型表，真实可写能力需要 Surface 输入、config、binding 和 inspector 相互对应；需要面板编辑时用 `inspect_hypit_scene` 查看实际 controlValue 和参数 ID。控制单位来自 inspector，例如百分比的 10 不能误写成 0.1。组件元数据的默认时长和画幅是参考规格；实际 window 与布局遵循当前工程。

ImageMotion 的图片输入优先使用 PNG/JPEG 的原生 Image Artifact；当前本地 Hyperframes 渲染不支持 `image/svg+xml`，SVG 即使声明 MIME 后编译成功也需先用已有本地能力栅格化，再检查真实渲染。

调用方保存用户文案、颜色、媒体身份与时间窗。只改文字或动作强度时用现有编辑；未公开的参数或结构才进入源码。新增可复用行为保留 activation、producer、Author Package、Studio Companion 与时间谱系，必要时增加版本，消费者明确选择更新。

## 透明叠层

只有当前组件声明透明输入时才启用；核查 render.js 的背景层确实关闭或透出底片。组件 z 与底片 stack-order 决定层级；模糊、光晕和底衬不应铺成意外的整屏遮挡。读实际 Track 输出后接 Film：Media Track 常用 `.visual / .audio`，组件可用 `.track`，不能互换。

沿用素材 editing.document/prepared.media，不重复准备已有引用。真实视频可用区间、原声选择、字幕位置和项目时钟继续保留；图片位移与缩放只作为图文运动，不替代用户要求的真实动作。只有该段需要且素材确有原声时才接入其 audio，避免重复叠加声音。

## 统一帧求值

已有 browserProgram / producer 的 `return frame => …` 以传入绝对帧为权威。窗口、帧率和 native clock 的转换沿当前已验证实现，不自行另建墙钟。每个元素的位置、透明度、显字进度或路径位置由“当前帧 + 配置 + 固定种子”计算；先前播放顺序不应参与。

新增简单行为时可采用下列自包含数学配方；复用原设计时保留其 easing 与共同时间，不用此配方替换已有曲线。它只计算数值，不是一个新的渲染接口：

```js
const clamp01 = value => Math.max(0, Math.min(1, value));
const phase = (frame, from, to) =>
  to <= from ? Number(frame >= to) : clamp01((frame - from) / (to - from));
const ease = value => value * value * (3 - 2 * value);
const mix = (from, to, progress) => from + (to - from) * progress;
const stateAt = (frame, cues) => {
  const enter = ease(phase(frame, cues.enterStart, cues.enterEnd));
  const leave = ease(phase(frame, cues.exitStart, cues.exitEnd));
  return {
    opacity: enter * (1 - leave),
    offset: mix(cues.offset, 0, enter),
    reveal: enter,
  };
};
```

cue 值是同一时钟下的实际帧号；字数阅读时长不包含进入段。进入/退出窗口按工程时段安排，不依赖默认示例数值。空间位置按 Canvas 与当前构图计算；目标标注、遮罩与跟随效果共用 world→screen 转换，不能分别硬写两组屏幕坐标。二维变换可表达层级或视差；真实 3D 投影、材质和景深须有当前运行时实现，不能由名称或模糊效果推定。

## 最小验证

改动结构后 commit 已包含编译检查，随后选进入中、信息落稳、退出和相邻切点的真实帧。改变运动行为时补一个不超过 3 秒的小样；改了字心或颜色通常只需看相关代表帧。自编逐帧逻辑还要在同一配置下跳到代表帧、先看晚帧再回跳，确认状态与连续播放的对应帧一致；已有稳定组件无需每次重复验证随机性。

若实际出现错误，读取相关模块或精准 vocabulary 修复，不先查完整框架、重复测量全部布局或把合格片段重导多次。来源与能力未变且验证通过后继续制作；整片交付仍走 frame-commercial-video 的 export / probe / 真实审片路径。
