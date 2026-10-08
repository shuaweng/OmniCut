---
name: frame-commercial-video
description: 在 Frame 制作或修复有旁白、字幕及生成镜头的商业广告。直接复用已接通的生成、等待、Hypit 编辑和成片导出流程，避免重复查工具用法；不用于仅咨询或单张图片任务。
---
# Frame 商业视频制作

## 一条工程贯穿制作
先 get_project_context 取得当前画幅、revision、素材和任务。用户已确定的目标不再提问。draft=true 是空白工程，不是12秒模板。使用 `skill hypit` 加载原项目技能，按它的 SVML/SVS/SVRun、语义与空间表达创作。本技能只负责 Frame 服务衔接，不替换 Hypit 的创作模型。普通参数与时间修改先 inspect_hypit_scene → edit_hypit_scene / adjust_hypit_timing；结构创作 checkout → read/edit → commit。不要写 frame-composition.json 或从固定镜头模板重建已有工程。

先根据旁白语义划镜头区间，再按所需时长裁视频；不要自动等分或为了转场偏移主切点。对齐“讲质地时看质地、讲使用时看使用、品牌结尾时看产品”。字幕使用 checkout 返回的 FrameSans-Regular.otf 常规中文字体，display.ttf 是得意黑斜体，不能当通用正文字体。

保持一份镜头表，字段为：中文场景名、画面意图、预期媒体类型、素材身份、目标时间段、对应旁白。生成图片是首帧或参考，不等于镜头视频。用户要实拍感/商业视频时，缺少视频的场景不能偷偷改成图片缩放后宣称完成；品牌尾板、用户明确要求的图文/MG可以用图片。

代码动效也是原生剪辑的一部分。品牌揭幕、产品卖点、结尾字标等先 list_motion_components → use_motion_component，按包 README 将原生 Track 接到同一 Film，保持其他镜头和音轨。文字/色彩/节奏参数留在调用方 SVML，可继续由用户或 Agent 编辑；不要把代码动效先压平为视频再宣称可复用。确有新视觉行为时创作自己的 packages/ Author Package，验证后 save_motion_component 沉淀；不要为了“动效丰富”给每镜套相同进场动画。

## 参考改编是一条完整任务
用户上传参考时先 analyze_reference，ratio/targetDuration 按用户要求；未指定画幅则跟随参考。preserve=structure 保留叙事节奏、style 借鉴视觉、shots 借鉴构图运镜。先看方案只分析并 await_tasks，ready 后呈现工作台方案并停止在确认点；不提前收费生成素材。已分析的参考在 get_reference_plans，禁止重复分析同一输入。

理解服务失败后，若可通过本地关键帧继续：stage_asset 取得实际路径，按原生 media 文档抽帧、逐张 read_image，记录源时间点与观察。使用 recover_reference_plan 把完整方案和实际 evidence 回填同一个 referenceId；不要另起一份与参考工作台脱节的计划。未检查音轨就 audio.reviewed=false，明确运镜与声音的观察局限。该工具不会生成素材或改变时间线；回填后仍按用户的“先看方案/直接制作”选择继续。无法取得真实证据时保留失败状态，不编造 ready。

用户点击“按方案制作”或明确直接制作后：apply_reference_plan → generate_reference_video → await_tasks → 原生工程编排、声音、字幕 → export_video → 检查实际成片。apply 在空白/原生项目中只保存共享方案，不插入旧模板；不需要手工补造 product 类型镜头。get_project_context.productionPlan.referenceId 是当前采用方案；每段有稳定 id，get_reference_plans.jobs.sceneId 对应真实生成结果。镜头重排和工程转原生不会丢失这层关系。方案 scene 可设置 imageFile（本镜头商品/关键帧图）、references:[{file,role}]（原生生成服务的多模态引用）与 useSourceVideo。RunningHub 与 MiniMax 的结构/镜头参考默认用 Hypit media cut 截取真实原片片段后送入模型，不只依赖文字；商品图必须同步绑定，避免沿用原片商品。只需借鉴文字分析时设 useSourceVideo=false。方案 duration 是成片剪辑时长，允许0.5–15秒；生成素材按模型最短时长补足，必须按方案剪取，不能让生成时长覆盖剪辑节奏。已生成的素材默认复用，修改台词/转场/字幕不重新生成视频。需要重生成只传指定 indices 且 retry=true。

不要照抄方案配音的估算时间：实际生成旁白后，用真实语音时序决定字幕和局部镜头切点，再 set_production_plan 同步最终场景时间；保留场景 id 与 referenceId。若新片缩短到15秒，需要明确保留的原片叙事关系，不能套环境—肌肤—产品三等分模板。前3秒应建立商品或品牌关联，相邻段保持光向、色温和动作关系；优先利用动作切点/形状匹配，过渡不是一律加淡化。参考方案中的 caption 是候选，旁白字幕以实际台词为准。

商品身份图必须真正送入生成调用；生成包装文字不可靠时，尾板用原始商品图并裁掉多余空白。画面标签、场景名均用简短中文；旁白字幕样式克制，在实际成片分辨率查看字心、对比、主体遮挡。改剪辑后重新抽查每个切点前后，确认没有空白或上一镜提前消失。失败原因根据实际输出说明，不把一般语法错误归因模型差，不无故升级服务。

## 媒体生成的正确入口
- 图片：先看 imageConfiguration，省略 provider 跟随默认服务；Musk 使用 GPT Image 2.5 Sunburst（最多4张参考，默认 medium；仅用户要求精细时用 premium/high），RunningHub 使用 Seedream 5 Pro（最多10张参考），火山最多4张。不要为了提高清晰度擅自更换用户已选服务。generate_image 的 imageFiles 使用当前素材库 UUID 文件名，不能传工作区路径。商品参考要实际传入，不能只在提示词提及。
- 视频：generate_video 使用 operationId（稳定唯一场景名）、prompt、name（简短中文）、duration **4–15秒**、ratio。3秒剪辑片段先生成4秒再取段。原生工程 autoApply=false，省略 shotId；独立生成可省略 revision。先看 videoConfiguration。provider=runninghub 使用 Minimax H3 RH Enhanced，480p/768p/1080p，默认768p，不支持2K，不自动切回Seedance。原生声音 audioMode=native；锁定已有配音或音乐用 audioMode=lock_source + drivingAudioFile；reference_only用于音色借鉴，remix_source改编已有音轨。参考图/视频/音频从共享素材库传file，Frame自动上传，Agent不用寻找公网链接或处理节点参数。provider=minimax 用 H3 768P/2K；H3 Max 是极速版，480P/768P且最短5秒，不是画质升级。不传 provider 跟随用户默认服务。Seedance 的1080p 需要 quality=premium（Seedance2正式版），按用户质量要求决定，不盲目升级所有素材。
- 按依赖分组等待：首帧完成即可提交该镜视频，不把短图像任务与无关的慢视频任务放进同一个全部完成屏障。已有就绪结果先推进后续；仅在组装前等待全部必需镜头。await_tasks 的 nextStep 简短说明下一步；随后结束本轮，由DSH完成通知接续。不要在同轮 job_output(wait=true) 长时间等待，也不使用 bash sleep/curl 循环查询。中途用户补充不抛弃已完成素材。
- 网络超时不等于模型生成失败。存在远端ID的 paused 视频任务用 resume_video_task，图片任务用 resume_image_task 继续查询，不重新 generate_video。recovering 表示服务自动恢复查询，继续 await_tasks。unknown 且无远端ID的任务不能重复提交。
- 不用失败的占位图完成真实视频镜头。生成结果全部就绪后再组装。无法恢复时只说明具体缺少哪个镜头以及可选处理，不自行降级交付。

## 旁白与字幕共享真实时钟
配音遵守用户选择与 audioConfiguration.speechProvider；ElevenLabs 用 provider=elevenlabs，MiniMax 用 provider=minimax、languageCode=zh。MiniMax Speech 2.8 优先用原生词级 words/evidence 调用 prepare_hypit_speech；只有没有时序时才用 transcribe_media 获得真实 words；先看 transcriptionConfiguration，已启用本地识别时由原生 WhisperX 完成，中文用 zh、英文用 en，无需上传或另填 Key；不能自己均分时间戳。已有选定音色可直接复用，只有新选音色才 list_audio_voices。15秒广告先精简台词，给片头/收尾留空间。生成整段旁白，取 await_tasks 返回的实际 duration、alignment。不要按3秒一个镜头猜字幕时间。

对白字幕必须来自实际说出的文字。使用 prepare_hypit_speech + 原生 Caption/Take 的语义链；有旁白时默认使用原生 Script → SemanticTake → Timeline，字幕、随语句出现的画面和音效引用同一 selection/moment。原始词或字符证据保留测量值；ASR 的繁简差异、漏字或同音误识别交给原生 speech-alignment 对齐已确认的 Script，不能为通过字符串匹配把正确文案改成错别字，也不能自行补造证据时间。识别内容与真实台词差异很大时先检查音频。只有纯画面标题或确实与语言无关的事件才用绝对时间；不要把语义绑定退化成一批固定秒数。字幕在成片的时刻 = 旁白起点 + 原始时刻 - 音频 trimStart。变速后必须同步变换时间戳，优先不变速。修改台词则重新生成相应旁白并重算字幕。画面标题可以不逐字复述，但不能被当成对白字幕。

商业广告先明确旁白、整片连续配乐、镜头环境音/动作音效三层声音方案。配乐用 generate_audio(kind=music) 生成整片长度的纯音乐，不给每镜各生成一首再硬接；音效用 kind=sound 按实际动作少量点缀。独立旁白主导时关闭生成视频里的重复人声和冲突配乐，但原声有用且可独立保留时不要一律静音。旁白、配乐、音效保持独立可编辑轨；先检查配乐自身的入尾渐弱，避免重复叠加长淡出导致品牌收尾近乎无声；人声期间压低音乐，增益平滑过渡，不做硬跳，尾部适当回升并完整收束。需预处理时只处理配乐，不把旁白提前混死。音乐套餐未开通就不重试购买，也不能无声降级后宣称声音制作完成；只用已有授权素材，不用随机音调伪装商业配乐。导出后核对实际有配乐：仅看到一条AAC音轨并不能证明混音包含音乐。

## 编排、保存、交付
checkout_hypit_project 返回 directory（通常 hypit）、revision、源码列表和 CLI 文件路径。CLI 是可执行文件，不是文档目录。已有源码须先 read 再 write/edit，DSH 会拒绝覆盖尚未读取的文件。不要为了整理目录删除素材或打印全目录；只处理本次需要的文件。工作区内 read/write/edit 修改源码；新素材用 sync_hypit_assets 一次增量同步到hypit/assets，只有独立检查才stage_asset。不要连续重新 checkout 覆盖自己的草稿。所有新项目直接保留 Hypit 原生表达：独立素材/Normalize、Script/Take/Timeline、语义挂接、空间 Frame、可复用组件与 Film。已有工程保持源码或 Studio 编辑，保留手动改动与其他轨道。edit_hypit_scene 的数字使用 Inspector.controlValue（原生 UI 数值）；value 是 Author 原始值，不可直接照填。音量显示20%时提交10得到10%，不是提交0.1。一组相关调整用原生 mutations 数组一起提交与撤销。

check 用 `run_hypit_tool({args:'["check","main.svml"]'})`，plan 用 render.svrun，不省略文件名。不要猜 render 配置文件名。commit_hypit_project 回写工程，随后 **export_video** 才会形成项目【成片】记录。build_hypit_project 用于额外原生产物，不能代替项目成片导出；outputs.name 必须是实际公开输出名，不能猜。

export_video 的 summary 填本版实际修改，如“字幕对比度调整”，不把尚未检查的版本称为最终版。导出只提交一次，await_tasks 等待 export:ID。完成后 stage_export(jobId) 将真实成片放入代码工作区并返回 file；用这个路径抽帧/探测，不猜 native-builds 等内部目录。完结后看实际文件与关键切点：媒体种类/运动、音轨是否重复、字幕与语音时序、产品身份与比例、时长画幅。镜头数、区间和素材类型从保存的工程核对，不能把预期当事实。包装字样失真或产品身份漂移时如实指出，重要品牌尾板优先用真实商品图与可编辑字标合成，不把模型生成乱码宣称为稳定品牌。像素/响度合格不等于商业质量合格；没有试听不能声称配音自然。

对用户展示的素材名、文件名使用中文：如「百雀羚眼霜·广告成片.mp4」「百雀羚眼霜·画面检查.jpg」。publish_workspace_asset 支持 name 展示名。最终回复简短展示成片和必要限制，不贴路径、JSON、完整检查日志，不要求用户点“交给助手”才能使用现有素材。

## 方案、修改与成本
新片先 rename_video_project 起简短中文项目名，再 set_production_plan 保存时长、比例和中文镜头表；方案出现在画布上，不把空白占位镜头交付给用户。镜头运动须为商品和字幕留出全程安全区；检查结尾动态位置，不能只看第一帧。
输入中的中途修改优先处理；已提交生成不可假装取消，说明哪些会保留，避免旧提示词继续提交下一镜。只询问产品身份/关键事实等实质缺失，常规创作自行完成。
重做素材只重做存在问题的镜头。采用新素材后 organize_asset(replaces=旧素材) 标注版本，同时修改真实工程引用；未经观察不要标为采用。改名只用 rename_video_project，fork_video_project 是明确另存版本。
配乐默认跟随 musicProvider。MiniMax music-3.0 仅历史付费账户可用，不能用已停服的 free 模型；没有精确时长字段，按实际产物剪辑并设计收尾。账户无权限先说明，不偷偷改用其他付费供应商。H3 内建有声，用于环境和动作；跨段连续音乐仍做一条独立整片配乐。
质检用 analyze_video(purpose=quality)，它支持全部工程，仅分析不修改。返回的 issues 是实际模型观察证据，结合最终导出抽帧与音轨检查再决定针对性修改。图片漂移先修真实参考与提示词；视频漂移先修镜头/运动描述，仍失败才按用户授权升级。不能把高分辨率当产品准确性。

MiniMax H3 默认先用 768P；2K 会增加每秒费用。价格取 videoConfiguration 中已核对的单价，参考视频还会单独计费，不能只按输出秒数报全包价。任务返回的实际 duration 可能与请求时长略有不同，必须按探测到的素材时长取段；不能假定每条4秒请求恰好产出4秒。

## 创意导演协作
先加载 frame-ad-creative，按其中的简报与验收方法决定创意。可调整建议不得改写成硬约束；不要把模型最短素材时长变成固定镜头时长。
若工具列表有 creative_director，新片或参考改编在理解参考、核对商品后先委派一次创意方案。传目标受众/投放场景、时长画幅、已核实卖点、参考的节奏与镜头关系、可用素材摘要、品牌和生成约束；不要传整个聊天、源码、素材文件或工具日志。简报上限 350,000 UTF-8 字节，过长先总结。要求交回一个创意主张、真实可读的旁白、时长总和精确的分镜，以及整片音乐/音效方向。拿到后由 DeepSeek 核对并保存 production plan、生成和剪辑；Opus 无媒体与代码工具。每轮至多一次初稿、一次有具体问题的修订；不为每镜重复调用，不让它处理报错、工程或纯剪辑修改。未配置/暂停时由 DeepSeek 完成创作，不阻塞用户。

## 局部审片与修复
字幕样式依据创作气质：唯美、优雅广告默认无实心底框，白色常规细字配轻阴影/细描边；局部亮底难读时才加克制的底衬或调整安全位置。references/hypit-editing.md 提供准确字段；在明亮背景与商品同框处预览，再完整导出。字幕使用真实字级时序；理解模型报告几十毫秒“疑似提前”不足以全局平移，先对照相应帧与语音证据。样式修改不改变镜头切点、旁白或整片字幕时钟。声音先试听/检查完整连续音乐与人声关系，再调整音量，不能只追逐一个响度数字反复渲染。不要宣称主观质检已完成而实际只运行了技术检查。

历史失败不是当前账户状态。recentFailures 仅作排查线索，已成功的同服务同模型调用优先；本轮只出方案时不要要求用户重开套餐，更不能从旧错误推断新任务必然失败。

## 先判断，再局部修复
检查发现问题后记录“时间段、观察、证据类型、最小修复”，不输出自评分和全通过承诺。字幕遮挡先移动/调整对比；音量问题先改对应独立音轨；液体/手部坏帧先判断取段、缩短、裁切或替换已有镜头是否可救，再决定是否只重生成该镜头。不能断言“只能重新生成”，更不能因此重新生成整片。用户已授权完成制作时，常规局部修正自行完成，不机械停在建议；服务升级或超出授权才询问。

响度差不等于人声清晰，音乐频谱与密度也会掩蔽人声。音频标签是否朗读以实际音频/转写为依据，不凭时间戳长度断言。理解模型、ASR、元数据各自有误差；未试听不声称亲耳确认，模型无报告不等于确定无问题。质检是制作决策，不是继续堆检测：有具体差异才扩大检查，修正后验证该处和衔接；没有新问题就交付。


## 本地验收沉淀：连续性与留白
- 人物首次定妆后记录同一人、发型（例如低发髻而非长马尾）、衣服、持物与左右关系；商品记录瓶型、开盖方式、标签与比例。创意导演的描述不是商品事实，生成前用真实图确认，不把翻盖写成旋盖。各镜检查首尾的实际画面，与定妆参考对照；只重做出问题的镜头。
- 旁白先按句意排入镜头，品牌句保留在尾板。不能把17秒旁白直接从0秒念完，却让分镜持续30秒。移动或剪开旁白时保持自然语速、声画语义和同一套真实对齐证据，不能仅以“字幕跟音频对齐”判定节奏合格。
- prepare_hypit_speech 返回 captionTiming：忽略标点拖长的静默后，由实测发声首末字导出的 spoken/silence。把这些素材时刻随 Take 的取段和位移一起映射，使用原生 Caption Hidden 或语义选择控制留白。尤其检查长停顿中下一句是否提前挂出；不以“正常提前半秒”掩盖数秒错位，不修改原始证据来掩盖组件分组问题。
- 检查拼图、抽帧和诊断音轨放在 hypit/analysis/ 或工作区 analysis/，不 publish_workspace_asset。只有会进入成片或需要用户选择的媒体入正式素材库；已成功片段原样复用。
- 尾板使用真实商品图时，背景颜色与图片底色一致，或正确去底；预览必须检查矩形边界。极轻的可选音效不值得反复计费重生成，更不能自行合成电子滴声凑数。
