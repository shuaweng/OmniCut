---
name: motion-direction
description: 为代码或混合镜头选择完整设计场景或基础动效，读取实际源码并改编版式、内容与时间片段，落实到可编辑影片；用于动效创作、风格提升和参考效果改编，普通文案或单个参数改稿沿用原生编辑。
---
# 动效设计与编排

目标：让运动表达当前商品、信息或情绪。产出：选中的动效组件、调用参数、关键时间点与真实预览；进入当前 Canvas / Timeline / Film 的原生 Author Package，继续编辑和导出。

## 从表达选动作

复用已确定的简报、分镜、品牌和真实语音时序。每镜先确定“观众先看到什么、发生什么变化、最终理解什么”，再按用途选择标题、图形、界面、图表或透明叠层。需要创作新方向或参考改编时读 [direction.md](references/direction.md)；已采用的方案直接实施。

需要参考实现时用 `list_motion_components` 找候选，可用 `query` 关键词或 `kind` 筛选。`kind="scene"` 是带连续构图与节奏的完整设计场景；`effect` 是基础动作、图表或叠层。结合 `category / tags / recommendedUses` 与当前表达选择，完整场景可采用其中一段，基础组件适合局部信息关系；不由数量、名称或渲染通过推定商业质感，也不要求每镜都用库。

`get_motion_component(componentId)` 只读 README、`parameters / nativeFonts / segments / sourceFiles / sourceDuration`，先判断实际接口、源片段和字体需求。`duration` 是目录预览规格，完整源片长以 `sourceDuration` 和 README 为准。已有上下文的目录无需反复查询。元数据与样片用于选型，当前品牌、故事和镜头顺序来自任务；真实效果由当前工程预览确认。

## 接入与修改

1. 选定后 `use_motion_component` 返回 `starter`：可编译的 Film、真实字体、合并片段、公开参数与源时间窗。新空白工程可传 `initializeDraft:true`，工具直接写入最小草稿，下一步 commit→preview；已有影片只合并 `starter.merge`，保留所有旧镜头和声音。`segmentId` 采用详情中真实 id，`start/duration` 放到本片时间，时长不能越过源段。公开参数已能满足需求时不先遍读整个包。
2. 加载 `video-workspace` 组装；先读当前 `main.svml/look.svs`，采用 starter 的实际 import/Surface/Track、字体与单位，改公开内容、颜色和源片段。提交首版并看真实画面之后，未公开的故事、界面或摄影行为才从 `sourcePaths` 读对应文件，沿 [reuse-authored-scenes.md](references/reuse-authored-scenes.md) 保留原构图、曲线和共同时间。需要叠层或新行为按需读 [native-assembly.md](references/native-assembly.md)。普通参数先 `inspect_hypit_scene → edit_hypit_scene`，时间窗先 `adjust_hypit_timing`；使用 bundle 的包改源后按 `localBuild` 调用 `rebuild_motion_component` 再 commit。
3. `commit_hypit_project` 后 `preview_frames` 检查进入、信息落稳、退出和相邻切点。运动关系用不超过 3 秒的小样；工程小样静音。修复实际问题后验证该处，合格就继续当前制作，不重复检查或穷举工具。

首版是一个能提交并预览的实际工程，不是长推演。已取得 starter 后，先 read 当前两个调用方文件→写接线和公开文案→commit→preview；素材尚未齐时先用已有素材和代码把完整时间线立起来，生成任务并行等待。连续8次源码/文档读取仍没有新工程产物时，停止泛读，利用 starter 提交最小首版；实际编译错误才精准查缺失接口。未看首版前不反复比较源段时长、过渡微差或穷尽阅读整套框架与全部原片模块；只有缺失接口或具体错误阻碍当前接线时再读相应文件。中文阅读、构图和切点以首版画面修正，不能用持续推演代替可审阅结果。

字体、版式、曲线和转场保持同一风格语法；相邻镜头按信息关系变化动作。阅读时间从文字完整显示且可辨认开始，给用户看懂信息的停留，再退出。画面和音效事件采用同一时间依据；已绑定音乐节拍或真实旁白锚点优先，不机械每拍切镜。

原生库和当前能力决定能实施的效果。分层视差、图片缩放或模糊不能证明真实 3D 摄影、景深或物体运动。新行为保持可编辑源码与绝对帧求值，只在确有需要时扩展组件；外部样片与技能是参考资料。本文方法来源与适配范围见 [sources.md](references/sources.md)，无需在普通制作时加载。
