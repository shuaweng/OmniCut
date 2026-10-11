---
name: frame-commercial-video
description: 制作或修复商业视频，将创意、已有或生成素材、声音与原生代码镜头接入同一可编辑工程，并预览、审片和交付；纯咨询或单张图片任务不使用。
---
# 商业视频制作

目标：把用户方向落实为可播放、可继续编辑的成片。产出：中文制作方案、原生 Author Packages 工程和真实导出。完成标准：所需画面与声音已进入工程，关键区间有实际检查证据，成片可播放，未核实项如实说明。

## 按当前阶段推进
1. **定位与简报**：get_project_context 读取目标 videoId、revision、品牌快照、引用、素材及任务。复用已有结论；新广告或参考改编加载 frame-ad-creative。方向未定的新片或参考改编，首次生成素材前默认用原生 ask_user_question 提供一两个具体表达方向与推荐理由；“你定/直接做”、已有采用方案、方向已明确或纯局部剪辑时跳过，已回答就继续，不重复权限或预算确认。只看方案或仍待答时停在方案。
2. **保存方案**：set_production_plan 保存时长、画幅、稳定场景 id、画面意图、对应旁白和逐镜 route。generated 使用真实拍摄或模型素材，code 使用原生文字/图形/界面动画，hybrid 融合两者。每镜按表达选择，代码镜头写明设计意图与节奏依据，避免每镜套同一种进场动画；代码镜头无需先生成媒体，图片缩放不能冒充用户要求的真实运动。
3. **准备当前所需输入**：复用合格素材；需要生成或参考改编时读 [generation.md](references/generation.md)，需要声音/字幕时读 [sound.md](references/sound.md)。能力与参数以本轮 Configuration.capabilities 为准，沿用用户最新选择。
4. **组装第一版**：加载 hypit，按 [composition.md](references/composition.md) 的最短路径在同一 Film 汇合素材、声音与代码。参数修改先 inspect_hypit_scene → edit_hypit_scene / adjust_hypit_timing；结构修改使用工具返回的真实工程路径读写并 commit。code/hybrid 加载 video-workspace；需要动效参考时加载 motion-direction，按用途选择完整设计场景或基础动作，get 读接口后 use 并读实际源码，再改内容和源片段。选中包的 README/原设计优先，recipe 仅补接线。新接口才查对应文档。
5. **预览与交付**：按 [review.md](references/review.md) 查看代表帧或可用短小样、做最小修复，再 export_video → await_tasks → 检查实际产物并交付。生成任务完成或编译成功都不是成片交付。

按需读取 [hypit-editing.md](references/hypit-editing.md) 的精确字段；需要镜头表、沟通或审片记录示例时读 [examples.md](references/examples.md)。已有上下文中的参考不重复加载。人物讲解使用 frame-presenter-video 的可运行组装路径。

## 工程衔接
draft 是空白工程；同一工程保留素材身份、真实语音证据、手动修改和独立音轨。没有 compose_video 工具，也不另写 frame-composition.json 重建成片。已返回 editing 时直接导入 editing.document/media；缺少准备引用才同步。publish_workspace_asset 的发布边界见 review.md，checkout 和冲突处理见 composition.md。
