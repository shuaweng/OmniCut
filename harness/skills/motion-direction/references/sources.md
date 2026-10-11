# 方法来源与适配说明

本技能为 OmniCut 自编指令，2026-10-10 静态核查以下公开资料后形成。没有复制外部技能的完整提示词、安装脚本、渲染器或素材；native-assembly 中的数值配方是本项目自写示例。普通制作无需联网加载这些来源。

- [Lemo STYLE 模板](https://github.com/lemomo-ai/lemo-opuscar/blob/a75e2b3384cded87955c8743b5a59db06ea491a8/styles/_template/STYLE.md)：借鉴风格规则与 Demo 故事、时序分开保存的设计，适配为当前品牌与信息决定运动。
- [Lemo DIRECTOR](https://github.com/lemomo-ai/lemo-opuscar/blob/a75e2b3384cded87955c8743b5a59db06ea491a8/DIRECTOR.md)：借鉴镜头意图、动作阶段、文字可读时间及真实预览。固定运动数量、静默配额和问答停点没有迁入本技能。
- [Lemo TECHNIQUE](https://github.com/lemomo-ai/lemo-opuscar/blob/a75e2b3384cded87955c8743b5a59db06ea491a8/TECHNIQUE.md)：借鉴同一时间依据驱动画面、声音与字幕，以及任意时间可独立求值。OmniCut 使用已有原生 SVML/SVS/SVRun 与 Film，未接入其 HTML/Three.js/TTS 管线。
- [Lemo readcheck](https://github.com/lemomo-ai/lemo-opuscar/blob/a75e2b3384cded87955c8743b5a59db06ea491a8/core/render/readcheck.mjs)：借鉴“未检查”与“通过”分开报告。本技能要求从实际文字显现完成开始判断阅读，并结合真实画面；不把该工具的元数据边框检查当作像素、遮挡或对比验证。
- [Awesome Claude Video Skills](https://github.com/zhuyansen/awesome-claude-video-skills/blob/2cccd56da9e418bdd8c622fdc9ec98886af08c21/README.md)：用作能力索引，未把项目数量、星数或第三方 SAFE 标签当作可执行性与安全验收。

Lemo 核查提交为 `a75e2b3384cded87955c8743b5a59db06ea491a8`，根 [LICENSE](https://github.com/lemomo-ai/lemo-opuscar/blob/a75e2b3384cded87955c8743b5a59db06ea491a8/LICENSE) 是 MIT，样片第三方素材保留各自许可。Awesome 列表本身为 [CC0](https://github.com/zhuyansen/awesome-claude-video-skills/blob/2cccd56da9e418bdd8c622fdc9ec98886af08c21/LICENSE)，各个链接项目许可证独立。移植第三方实现或素材时仍需保留相应许可与来源；本技能不扩大下载、安装、上传、付费服务或发布权限。
