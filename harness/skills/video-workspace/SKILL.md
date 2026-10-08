---
name: video-workspace
description: 在项目独立代码工作区编写并渲染视频、图片、音频素材，再入库参与剪辑。
---
当前 cwd 是此项目的代码草稿目录。使用原生文件工具编写脚本，bash 执行本地 ffmpeg/ffprobe 或已安装的渲染器。
先检查依赖，不假称 Remotion 已安装。不要安装未经用户要求的依赖，不读取 .env 或系统密钥，不修改工作区外的 Frame 源码与项目。
处理已有素材先用 stage_asset 复制到工作区，从返回的 input/ 相对路径读取，不修改原素材。
供成片使用或用户选择的生成输出才调用 publish_workspace_asset，以相对工作区路径入库。质检抽帧、拼图、中间音轨留在 analysis/，不自动发布到素材库。入库会校验真实媒体，可在原生工程里引用。不要只交付代码就声称成片。
付费图片、视频生成使用 Frame 的 generate_image/generate_video；不要从 shell 绕过生成服务的幂等、结果入库与权限。
项目事实以 get_project_context 为准。生成提示词不等于已验证画面。

视频创作加载原项目 `hypit` Skill，使用 checkout_hypit_project 获取完整 Hypit 工程到 hypit/，保留 SVML/SVS/SVRun 与项目组件。通过 read_hypit_docs 按需学习原生文档与技能，不必安装第三方 skill。用 commit_hypit_project 提交源码而非仅 publish_workspace_asset 提交压平媒体。模型生成仍使用 Frame 工具，完成后重新读取素材表，将素材引用带入工程。

原生工程使用同一条通路：inspect_hypit_scene 读场景 → adjust_hypit_timing / edit_hypit_scene 调参数或语义锚点；复杂创作 checkout → 代码工具写工程 → commit。新增本地媒体会随 commit 入库，嵌套旧素材用 index_hypit_assets 获取共享素材身份。避免把原生工程退回三镜头模板。
独立图片、音频或其他原生产出：先 get_hypit_runtime，读取对应文档与 plan；写独立 SVRun，提交后 build_hypit_project → await_tasks 等待 hypit:ID → 读取 outputs.assetFile，再在原工程引用。影片仍可 export_video。不要只把源码当作完成，也不要在 bash 绕开构建服务生成付费内容。

可复用动效直接使用原生 Author Package：先 list_motion_components，找到合适组件后 use_motion_component，将返回的包与 README 接到现有 SVML 的 Canvas、Timeline 和 Film。它只准备代码草稿，仍需 commit 才进入预览；不要再次 checkout 覆盖它。改调用方文字、颜色、媒体引用、时段即可复用，不重写组件，不渲染成 MP4 再剪。
需要新动效时读 references/production/component-sharing.md 与原生组件文档，在 packages/ 下写自己的原生包，使用 browserProgram 的绝对帧时钟或原生图形/文本表达，公开参数与 Track，加入 Studio Companion；先在当前工程预览。用户希望保留风格/跨项目复用时，提交后 save_motion_component。包里保留 README、源码和必要资产；视频项目与品牌素材留在调用方，版本更新明确选择，不能顺手改变所有已有项目。
