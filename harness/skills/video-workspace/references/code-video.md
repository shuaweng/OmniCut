# 代码镜头与生成镜头共用工程

镜头表逐镜选择 route。`generated` 用真实拍摄或模型素材表现人物、商品操作、环境与真实运动；`code` 用原生文字、图形、界面、图表或数据动画解释信息；`hybrid` 将真实素材与可编辑的代码叠加编排到同一 Film。按创意选择，不能把缺失的真实运动镜头换成图片缩放后称完成。

先加载 `hypit`；沿选中包实际 README 与源码复用设计，需要接线示例才读本技能 [原生代码制作 recipe](native-code-recipe.md)。完整场景先加载 motion-direction 选取源片段与阅读原实现，不由简单品牌例子改成统一字卡。已有上下文或 README 已给出接口时，不重读整套 component-design / component-sharing / studio-companions，不反复查同一 vocabulary 或测量同一坐标。新接口或真实报错才按问题读取对应章节，在返回的真实 workspaceDirectory 下改项目 `packages/` Author Package；use 已准备草稿后不再 checkout 覆盖。公开的 Module/Surface、Track 与真实素材引用贯穿同一工程，不把可编辑代码先压成 MP4。品牌资料、用户文案、选段与项目媒体放在调用方，未公开内容才改实际场景数据。

需要用户继续调整的文案、颜色、位置、尺寸、样式与时序应有真实公开参数；默认值和单位由组件声明。Studio Companion 匹配实际 Module/Surface，在 `bindings` 与 `inspector` 中接到可写 Source 输入；有意义的 entity、picture selection、timeline 和时间谱系对应同一作者对象。声明 label 不等于参数已可编辑。包 activation 保留 producer 和 author contributions，并注册 Companion host facet。不要为一次性内部动画键强造几十个 UI 控件。

新组件使用原生图形/文字表达或已配置的 browserProgram，运动由绝对帧时钟决定，任意 seek 得到相同画面。先在当前 Run 验证进入、运动中与落稳的代表帧：保存/commit 后用 `preview_frames` 取得真实图片；工具若支持短 sample，可用不超过3秒的小样检查运动。不要为看一个局部就完整导出长片，也不能只看静帧便声称完整动作已检查。确认关键画面、文字字心、遮挡与编辑控件后再整片导出；`probe_export` 核对最终技术产物，疑似静帧/黑帧先结合创意核实。

有旁白先沿真实 Script/Take 的 selection/moment 编排信息。`analyze_beats` 仅提供源音频起音节拍、BPM 估计与置信度；未确认强拍不可写成小节第一拍。先 list_beat_guides 读取真实音轨clip，再 bind_beat_guides 绑定 analysisId、assetFile 与当前revision；普通原Audio链自动核对来源并按真实音乐 timelineStart、trimStart、playbackRate 映射到Guide。未知派生源必须取得用户明确确认的 sourceOrigin，不猜时间偏移。Guide不移动镜头。在旁白语义区间内择有意义的强调或动作落点，不机械每拍切镜、不为对齐节拍移动关键台词。

验证工程编译、真实预览和需要的可编辑参数。用户需要保留风格或跨项目复用时 commit 后 `save_motion_component`，携带 README、源码、activation、Companion 和必要资产；保留版本，更新由消费者明确选择。
