# 第三方组件与归属

OmniCut 是一个个人视频创作产品作品集，围绕电商广告制作，对现有 Agent 框架、视频工程与模型服务做了整合和二次开发。本仓库免费提供源码，不是上游官方产品，也不代表与下列项目或品牌存在合作、背书关系。

OmniCut 自己实现的部分包括项目与多对话组织、素材与生成任务管理、模型服务适配、参考创作流程，以及连接聊天与视频工作台的交互。Agent 会话内核和视频编辑内核来自下列上游项目，没有将它们表述为从零自研。

除另有单独授权声明的第三方内容外，本仓库按根目录 [LICENSE](LICENSE) 中的条款提供。该文件保留 Hypit 上游许可证原文，包含在 Apache License 2.0 之外的附加条件，不能将整个仓库理解为 MIT 或标准 Apache-2.0 项目。以下第三方内容继续适用各自许可证。

## Hypit

- 上游：[hypit-ai/hypit](https://github.com/hypit-ai/hypit)
- Copyright © 2026 Hypit.AI。
- 用途：视频工程、原生 Studio 编辑器、预览与渲染、语义时间线、创作组件及 Skills。OmniCut 通过宿主适配与统一工程接口连接这些能力；Studio 在构建时接入本项目的展示与同步适配。
- `templates/hypit-chat/` 包含从 Hypit 0.2.17 示例改编的聊天动画，具体来源和修改记录见其 [NOTICE.txt](templates/hypit-chat/NOTICE.txt)，原许可证保留在该目录中。
- 许可证：Hypit 的附加条款版 Apache License 2.0，原文见 [LICENSE](LICENSE)，其引用的基础文本见 [licenses/APACHE-2.0.txt](licenses/APACHE-2.0.txt)。附加条款涉及多租户托管、商业再分发及部分展示面的名称、LOGO 和版权保留要求。是否需要额外授权，应以原文及上游书面授权为准；本仓库没有取得或授予这些额外权限。

## DeepSeek Harness

- 上游：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- 使用包：`@deepseek-ai/dsh`，版本 `0.2.0-rc.2`。
- 用途：原生会话、流式聊天与输入组件、子 Agent、工具调用、等待与继续执行、上下文管理、Skills 和 MCP 扩展机制。OmniCut 通过插件和展示插槽接入媒体任务与创意子 Agent。
- Copyright (c) 2026 DeepSeek。MIT 许可证原文见 [licenses/DSH-LICENSE.txt](licenses/DSH-LICENSE.txt)。

## 界面图标

- [Lucide](https://github.com/lucide-icons/lucide)，版本 `0.468.0`：用于界面操作图标，ISC 许可证原文见 [licenses/LUCIDE-LICENSE.txt](licenses/LUCIDE-LICENSE.txt)。上游注明其中部分源自 Cole Bemis 的 Feather（MIT），其余归 Lucide Contributors 所有。
- [Lobe Icons](https://github.com/lobehub/lobe-icons)，静态 SVG 版本 `1.95.1`：`src/vendor-logos/` 中用于识别服务商的品牌图标。MIT 许可证及来源记录见该目录的 [LICENSE](src/vendor-logos/LICENSE) 和 [NOTICE.txt](src/vendor-logos/NOTICE.txt)。品牌与商标仍归各自权利人所有。

## 字体

- **Noto Sans CJK SC Regular**：本仓库文件名为 `fonts/FrameSans-Regular.otf`，字体内部名称仍为 Noto Sans CJK SC，并非本项目原创字体。嵌入版权信息为 © 2014–2021 Adobe。来源：[notofonts/noto-cjk](https://github.com/notofonts/noto-cjk)。适用 SIL Open Font License 1.1，见 [fonts/OFL-NotoSansCJK.txt](fonts/OFL-NotoSansCJK.txt) 和 [fonts/NOTICE.txt](fonts/NOTICE.txt)。
- **Smiley Sans Oblique / 得意黑**：用于 `template/assets/display.ttf` 与 `templates/hypit-chat/assets/display.ttf`。Copyright (c) 2022–2024 atelierAnchor；保留字体名称为 Smiley 和 得意黑。来源：[atelier-anchor/smiley-sans](https://github.com/atelier-anchor/smiley-sans)。适用 SIL Open Font License 1.1，原文分别放在两个字体目录的 `OFL.txt` 中。

## 模型服务与演示素材

第三方模型通过用户配置的服务接口调用，未随仓库分发模型权重；调用权限、费用和产物使用仍受相应服务条款约束。演示中的品牌商品广告属于个人概念创作，用于展示产品流程，不表示品牌委托或商业合作，也不授予相关商标、肖像或外部参考素材的权利。

依赖树中其他包的许可证随各包发布；以上说明不替代它们各自的授权文本。
