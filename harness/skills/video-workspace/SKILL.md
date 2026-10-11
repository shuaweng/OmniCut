---
name: video-workspace
description: 在项目独立代码工作区用原生 Author Package 制作可编辑代码镜头，与真实或生成素材融合、预览和导出；也可构建独立图片或声音入库。
---
# 原生代码工作区

目标：用原生源码完成当前镜头或局部修改。产出：可提交的 SVML/SVS/SVRun、实际预览和需要公开的参数。完成标准：工程可编译，关键画面已检查，组件可继续编辑，影片通过真实导出交付。

## 沿已有工程推进
1. get_project_context 定位目标 videoId 与 revision。参数/时间修改先 inspect_hypit_scene → edit_hypit_scene / adjust_hypit_timing；结构修改加载 hypit，checkout_hypit_project 后使用返回的绝对 directory 和 CLI，按目标视频读写，保留未提交草稿。
2. 代码或混合镜头先沿选中包的 README 与实际源码实施；需要 Film 接线起步时读 [native-code-recipe.md](references/native-code-recipe.md)，其中品牌揭幕只是简单示例。完整设计场景加载 motion-direction，优先采用 use 返回的 starter 和真实源时间窗，公开参数先落成片；未公开内容才读对应源码复用参考，保留原字体、版式、曲线及源时间关系。先提交改编并看画面；新接口或真实报错才查对应 vocabulary / read_hypit_docs，不重读整套框架。组件和语义边界按需读 [code-video.md](references/code-video.md)。
3. 已有 editing 时直接导入 editing.document：图片用 asset，音视频用 prepared.media；只在缺少准备引用时 stage_asset / sync_hypit_assets，使用真实返回路径。set_production_plan 每镜保留 generated/code/hybrid，素材与代码在同一 Film 汇合；图片缩放不能冒充真实运动。
4. 需要库参考时 list_motion_components（query / kind 可筛选）→ get_motion_component 看实际参数、原字体、源片段与文件 → use_motion_component 取得 starter → 读当前 main.svml/look.svs → 用 emptyDraft 或 merge 接入同一 Film → commit→preview。新空白稿可传 initializeDraft:true 直接准备可提交首版；未公开行为再原生 read 对应 sourcePaths。工具准备草稿，commit 才更新工程；不再次 checkout 覆盖，调用方保存文案、颜色、媒体、时间窗与源片段，保留包 activation、Studio Companion 与辅助模块。基础动作或完整场景按镜头目的选择，未公开内容可在项目 packages/ 继续改，不重写原设计为简化近似版；按需要公开可写参数。
5. 修改已有文件先读取；原场景源码进入生成 bundle 时，按 use 返回的 localBuild 调用 rebuild_motion_component 后再 commit，直接改公开参数不需重建。commit_hypit_project 后 preview_frames 检查真实代表帧；需要运动检查时用可用的不超过3秒 sample。用户希望跨项目复用时 save_motion_component，保留 README、源码与必要资产，消费者明确选择版本。

人物讲解加载 frame-presenter-video，沿真实声音证据装配 Performance / Sound / Caption；prepare_hypit_speech 可在空白工程准备。独立图片/声音等产出用 get_hypit_runtime → 对应文档与 plan → 独立 SVRun → build_hypit_project → await_tasks，读取真实 outputs.assetFile 再引用；影片仍用 export_video 形成成片记录。

## 路径与发布边界
使用现有依赖和本地 ffmpeg/ffprobe；不安装未经用户要求的 skill、渲染器或依赖，不读取密钥或修改工作区外源码。模型生成使用项目 generate_*，保留幂等、权限与入库流程。
供成片使用或用户选择的本地媒体才 publish_workspace_asset，使用目标工作区内真实路径；诊断图片/拼图/音轨留在 analysis/。可编辑镜头通过 commit 提交源码，不用压平媒体替代 Author Package，不把代码本身当成已交付影片。
