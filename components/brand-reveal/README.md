# 轻盈揭幕

原生 Author Package：柔和光线、圆形线条与三层文字按帧揭幕。适用于品牌片尾、产品主张和镜头上的文字叠加；无需生成模型。

```xml
<import as="reveal" from="@frame/brand-reveal@1"/>
<reveal:Reveal id="brand-ending" timeline={program.timeline} canvas={canvas}
  font={font} start="25s" end="30s"
  eyebrow="大宝 SOD 蜜" title="把日子，润成诗" subtitle="每一刻，都值得温柔以待"
  background="#f3f5ee" color="#163d31" accent="#70947b"/>
```

将 `<film:Track source={brand-ending.track}/>` 加到现有 Composition 内，保留已有镜头和音轨。`program.timeline`、`canvas` 和 `font` 应引用消费项目现有对象。字体必须是真实 Font Artifact，例如 `<asset:Font id="font" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>`。**不要为了添加动效替换整片或压平成 MP4。**

默认不透明背景，可作为完整品牌片尾。设 `transparent="true"` 时，可叠加到已有产品镜头上；同时根据画面对比度选择文字颜色。`start/end` 服从原生时间线，`z` 控制层级；标题、品牌、颜色可在原生参数面板修改，Agent 也能修改同一 SVML。

尺寸从 Canvas 计算，支持横竖屏。默认时长由调用方指定，建议 3–6 秒。文案宜短，标题建议 4–14 个中文字符。

逻辑 Module ABI 是 `@frame/brand-reveal@1`，实体包版本为 `1.0.0`。每个项目使用自己的包版本；改品牌、文案、颜色和时间只改调用方 Source，修改可复用动画行为才改包并增加版本。实现使用原生 `browserProgram → VisualTrack → Composition → Hyperframes`，基于源仓库当前版本验证。
