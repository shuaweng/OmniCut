# 彩纸飘落

彩纸翻转飘落，标题弹出，适合庆祝与公告。 原生可编辑 Author Package，使用 Hypit / Hyperframes 按绝对帧绘制。

```xml
<import as="motion" from="@frame/confetti-rain@1"/>
<motion:Motion id="effect" timeline={program.timeline} canvas={canvas} font={font}
  start="0s" end="4s" title="恭喜上线" subtitle="感谢每一位同行者"/>
<!-- 在现有 Film 内添加 -->
<film:Track source={effect.track}/>
```

引用消费项目现有 Timeline、Canvas、Font。字体是实际 `asset:Font` Artifact；`start/end` 采用原生时间窗，`.track` 加到同一个 Film。包不会替换原片或音轨。默认不透明，可作为代码镜头；`transparent="true"` 可叠加到已有画面，按对比度选择配色。默认构图经 16:9 验证；竖屏需按镜头重新检查构图，建议 3–5 秒。

| 参数 | 面板名称 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `title` | 主标题 | text | 恭喜上线 |
| `subtitle` | 说明文案 | text | 感谢每一位同行者 |
| `background` | 背景颜色 | text | #fff8ee |
| `color` | 文字颜色 | text | #2a1f1a |
| `accent` | 主点缀颜色 | text | #ff5e5b |
| `secondary` | 次点缀颜色 | text | #00a6a6 |
| `x` | 水平位置 % | number | 50 |
| `y` | 垂直位置 % | number | 50 |
| `scale` | 整体缩放 | number | 1 |
| `speed` | 动作速度 | number | 1 |
| `intensity` | 运动幅度 | number | 1 |
| `transparent` | 透明背景 true / false | text | false |
| `z` | 图层顺序 | number | 50 |

上述参数均有可写 Studio binding / Inspector；数值与颜色在 Surface 校验后参与绘制。列表类参数使用逗号或竖线分隔，保持简短。改文案、素材、颜色、时段和公开参数只改调用方 SVML。改变动画行为须修改包实现并升级实体包版本，消费项目明确选择版本。

`activation.js`、`author-runtime.js`、`definition.js`、`render.js`、`visual-runtime.js` 均随包复制，未引用同级包或下载额外依赖。逻辑 Module ABI `@1` 与实体版本 `1.0.0` 分开。任意 seek 与区间渲染从绝对帧得到同一状态，无墙钟、网络或模型调用；随机效果使用固定种子。

`preview.mp4` 和 `poster.jpg` 是画廊展示素材，use 时不复制到生产工程。运行应用根目录的 `node scripts/build-motion-previews.mjs --component confetti-rain` 可在隔离本地工程用公开 Source 与原生 CLI 重建。
