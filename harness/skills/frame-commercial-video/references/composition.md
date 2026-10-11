# 素材到成片：同一个原生工程
新片和已有工程都保留 Author Packages 的表达，不用另一套镜头 JSON 重建成片。本项目没有 compose_video 工具，也不维护 frame-composition.json。

## 最短执行路径
1. get_project_context 读取当前工程、素材与完成任务。先复用已有的合格素材和准备好的引用。
2. checkout_hypit_project 取得本对话的源码副本。已有未提交修改时先保留，不再次检出覆盖草稿。随后生成的新素材会自动准备引用，不需要重新 checkout。
3. 直接导入生成结果中的 editing.importFrom / editing.document。比如视频结果返回 document=`prepared/media/m-实际ID-30.svml`、media=`prepared.media`，则在 main.svml 中用小写别名导入该 document，以 `opening.prepared.media` 连接轨道。必须使用工具返回的实际路径，不能猜路径。
4. 声画编排采用原生 Script → SemanticTake → Timeline；prepare_hypit_speech 提供真实语音对齐与用法。字幕、画面与动作音效绑定同一 selection/moment，非语言事件才使用绝对时间。纯画面片也可直接使用 Timeline、Media/Performance、Audio 与 Film。
5. 保存 SVML/SVS/SVRun，再 commit_hypit_project 编译并提交工程。普通修改优先 inspect_hypit_scene + edit_hypit_scene / adjust_hypit_timing，结构修改才改源码。常见语法见 hypit-editing.md。
6. commit 后 preview_frames 查看真实代表帧/切点，必要且可用时先看不超过3秒的小样；确认后 export_video 一次提交，await_tasks 等待，probe_export 检查真实技术产物，按需要 stage_export 检查并交付。build_hypit_project 是额外输出能力，不替代项目成片记录。

每镜 set_production_plan 保存 route=generated/code/hybrid。代码镜头及混合素材同属原生 Film，复用 Author Package 并通过 Companion 公开需要编辑的参数；代码镜头不需要先生成位图。

## 直接使用准备好的媒体
以下是字段映射示意，路径、帧率、时长都以实际返回值为准：
```xml
<import as="opening" source="./prepared/media/m-实际ID-30.svml"/>
<media:Item id="opening-shot" media={opening.prepared.media}
  frame={full} appearance={look.media.clip} at="0s" for="3s"/>
```
图片结果的 kind=image，用导入模块的 asset；视频/音频结果的 kind=media，用 prepared.media。引用文件自带 Normalize，不要再对同一已准备媒体重复 Normalize。工程帧率必须和 editing.frameRate 一致；需要另一帧率时先用 sync_hypit_assets 准备对应引用。

视频取段由媒体 Recipe 的 trim-start / trim-end 控制，单位是工程帧；声音编排遵循对应 Audio/Sound 的原生字段。需要裁剪时按实际可用区间取段，不延长视频造成尾部黑屏。音轨独立保留，旁白移动后字幕继续绑定同一语义时间，不能均分猜时间戳。

## 冲突与局部修改
提交必须来自本对话的有效 checkout 基线。WORKSPACE_BASE_CONFLICT 表示另一对话或工作台已经更新工程：保留草稿，比较改动并另存所需内容，重新检出后只合并本次修改。不能拿最新 revision 强行提交旧副本，也不能删除新安装的 prepared/evidence 文件。

只有新的组件才查该组件文档。已有工程只读有关声明与样式，不扫描全套包。字幕位置、音量或一个镜头替换不重生成旁白、不重做整片；验证修改区间及衔接后交付。
