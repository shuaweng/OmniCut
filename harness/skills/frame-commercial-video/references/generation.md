# 素材准备与参考改编

目标：为方案准备可用且有明确身份的输入。产出：真实素材、场景对应关系与采用决定。完成标准：所需区间已检查，引用可直接导入工程，生成时长与剪辑时长分别记录。

## 先复用，再按能力生成
1. 读取 get_project_context 的素材、已完成任务和制作选择。用户之后的明确指令优先于面板默认；同服务同模型的真实成功结果比旧失败记录更能说明当前状态。
2. 从 imageConfiguration.capabilities / videoConfiguration.capabilities / audioConfiguration.capabilities 读取当前默认选择；显式改选 provider/model/quality 或音频用途时先 get_media_capabilities({mediaType:"image"|"video"|"audio",provider?,model?,kind?,quality?})，kind 只用于声音类型。按实际返回的 supported、duration、ratios、resolutions、references、audioModes、qualityMapping 与 defaults 传参，图片还看 sizes/outputSizes，声音还看 audioKind/supportedKinds。未列出的能力保持未知。limitsOrigin=local-validation 是本地接入校验，不能称官方能力证明。具体收费以实际计费信息为准，不能只用输出秒数推算全部费用。能力不足时说明具体缺口，不悄悄换服务。
3. 图片参考先 read_image，核对商品/人物身份与来源，再实际传入 imageFiles、imageFile 或 references。使用素材库返回的文件身份，工程中的本地文件路径另按 editing/stage 返回值取得。真实包装、标签与结构来自参考；生成提示词不是已经实现的画面。
4. generate_image / generate_video 使用简短中文 name 和稳定 operationId。生成素材按模型支持的范围准备，最终镜头依真实可用区间裁剪；最短生成时长不决定剪辑节奏。原生工程生成独立素材时 autoApply=false；完成后用 editing.document/media 接入 Film。
5. 检查动作初末状态、商品比例、人物外观与画面连续性，将素材 ID、可用/坏帧区间、证据和采用决定写入 production-notes.md。已有采用决定只在新素材、修改或未解决问题出现时复查。

## 参考改编保留同一方案身份
1. analyze_reference 按用户目标选择 preserve、ratio、targetDuration。已分析输入从 get_reference_plans 复用；只看方案时呈现 ready 方案并停止，直接制作则继续。
2. 核实商品事实和原片观察。生成前在 edit_reference_plan 保存每镜 imageFile、references、useSourceVideo；工具能力支持时携带真实源片段与商品参考。只借文字分析可明确 useSourceVideo=false。
3. apply_reference_plan → generate_reference_video → await_tasks。保留 referenceId、稳定 sceneId 和 jobs.sceneId；方案 duration 是剪辑时长，实际产物按探测时长取段。重新生成只针对确有问题的 indices，明确重做时才 retry=true。
4. 有实际旁白后，按真实语音证据调整镜头与字幕，再 set_production_plan 同步最终时间；保留原方案身份。code/hybrid 镜头仍由原生组件承担，参考改编不要求每镜都再生成视频。

理解服务失败而本地关键帧可继续时：stage_asset 取得真实路径，抽帧并 read_image，记录源时间与观察，用 get_reference_plans 的 version 调 recover_reference_plan 回填同一个 referenceId。未检查音轨保持 audio.reviewed=false；没有证据就保留失败状态，不编造 ready。

## 等待与恢复
- 按依赖分组：首帧就绪即可提交该镜视频，已有结果先推进；组装前再等待全部必需输入。await_tasks 的 nextStep 写简短中文后结束当前执行段，由后台完成通知接续。
- 网络超时不等于生成失败。已有远端 ID 的 paused 任务用对应 resume_* 继续查询；recovering 继续等待。unknown/blocked 先 get_operation_status 或按返回恢复动作处理，不以新 ID 重发。
- 同一方案与同一意图跨轮次复用 operationId；独立新方案或用户明确重生成遵循工具返回的 productionId/attemptId 契约。只在真实素材成功后引用 assetFile。
- 修改指令优先更新尚未提交的工作。已经提交的任务如实说明状态，复用已成功素材，不能声称取消了仍运行的生成。
