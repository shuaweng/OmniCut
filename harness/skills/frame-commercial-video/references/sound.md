# 声音、字幕与语义时钟

目标：让旁白、画面、字幕和音乐表达同一节奏。产出：真实声音、对齐证据及独立可编辑音轨。完成标准：台词与字幕一致，时序随取段/位移正确映射，混音包含所需声音；听觉评价只依据实际试听或对应音视频证据。

## 从旁白建立真实时钟
1. 依据目标时长精简台词，预留开场、动作和收尾呼吸。读取 audioConfiguration 的当前服务、音色和 capabilities；改选 kind/模型用 get_media_capabilities。已有选定音色直接复用，新选角才 list_audio_voices。语言字段和音色标签不等于已验证口音。
2. 用 generate_audio(kind=speech) 生成完整旁白，等待真实 duration、words/alignment/evidence。优先把原生证据交 prepare_hypit_speech；缺少时序才按 transcriptionConfiguration 调 transcribe_media。空白工程也能准备声音，无需临时造 final.video。
3. 将确认的 Script 与实际证据对齐，再由 Script → SemanticTake → Timeline 编排画面、Caption 和动作音效。对白字幕取自实际台词；ASR 漏字、同音字或繁简差异由 speech-alignment 对齐，原始测量证据保持不变。
4. 用 prepare_hypit_speech 的 captionTiming.spoken/silence 控制停顿留白。素材时刻随 Take 的 trim、位移、变速映射；字幕时刻不是均分估算。画面标题可以概括信息，不能伪装成逐字对白字幕。
5. 改台词同步更新该段声音、证据和字幕；纯样式修改保留原时钟与切点。普通字体用 checkout 返回的 FrameSans-Regular.otf；具体绘制、取段字段见 hypit-editing.md。

## 混音与节拍
先安排旁白、整片连续配乐、少量实际动作音效的分工。根据 audioConfiguration 生成或复用音乐，按真实产物时长剪辑并设计收尾；音效依画面动作选择。旁白、音乐、环境音保持独立轨，生成视频中的原声按目的取舍，避免重复人声或冲突配乐。

先检查音乐自身的包络，再用平滑增益让人声清楚、收尾完整。配乐频谱与密度也会遮蔽人声；响度合格不等于清晰或自然。素材库存在声音不代表已经加入 Film，最终应核对实际混音。

需要节奏证据时 analyze_beats → list_beat_guides → bind_beat_guides，将 analysisId、assetFile 绑定真实音乐 clip 和当前 revision。普通音频链按真实 trim/rate 映射；未知派生源需用户明确确认 sourceOrigin，不能猜偏移。beats 在旁白语义区间内提供强调或动作落点，低置信度与强拍候选保留不确定，不机械每拍切镜。

## 换音色保留真实契约
用户只换现有干声的音色时，优先 generate_audio(kind=voice-change)，传原 MP3/WAV 干声 referenceFile 与目标 voiceId，按工具约定保持表达和节奏。依据 voiceChange.gainCompensationNeeded 决定是否补偿；依据 timing.canPreserveTimeline 判断原剪辑能否沿用。结果缺少新时序时，不能复制旧 alignment 冒充测量；不兼容就转录并重新 prepare_hypit_speech。人物嘴型仍需画面检查。

服务不可用时先用已有授权素材或说明具体缺口，不把随机音调当商业配乐。未试听保持“未试听”，frames-transcript 不能证明音色、音乐或混音效果。
