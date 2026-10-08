# 已验证的常见表达
以下用于确认语法，不是预填到用户空白项目中的模板。

- main.svml 使用 `<?svml using="@hypit/markup@1"?>` 和 `<svml>` 根。
- 导入别名小写连字符，例如 `<import as="media" from="@hypit/media-track@1"/>`，不能写 mediaTrack。
- 样式文件 look.svs 使用 `<?svml using="@hypit/svs@1"?>` + `<sheet version="1">...</sheet>`；在 main.svml 用 `<import as="look" source="./look.svs"/>`，不要内嵌 `<svs>`。
- `media:Item.appearance` 要 `{look.media.clip}` 对应 `media.clip { fit: cover; }`，不是 Text recipe。
- 图片用 asset:Image / media:Item image + extent；视频用 asset:Video → media-pipeline Normalize → media:Item media。文件后缀与真实内容必须一致。

```xml
<asset:Video id="shot-file" src="./assets/实际视频.mp4"/>
<pipe:Normalize id="shot-media" source={shot-file} clock={clock}
  video="primary-moving" audio="none" span-authority="video"/>
<media:Track id="picture" timeline={program.timeline} canvas={canvas}>
  <media:Item id="shot" media={shot-media.media} frame={full}
    appearance={look.media.clip} at="0s" for="3s"/>
</media:Track>
```

完整工程的时钟、画布、轨道与电影：
```xml
<time:Clock id="clock" frame-rate="30"/>
<time:Timeline id="program" clock={clock} end="15s"/>
<space:Canvas id="canvas" width="1440" height="1080"/>
<space:Frame id="full" within={canvas} left="0%" top="0%" right="100%" bottom="100%"/>
<!-- picture、captions、mix 为本工程已声明的相应轨道 -->
<film:Film id="main" canvas={canvas} timeline={program.timeline}>
  <film:Track source={picture.visual}/>
  <film:Track source={captions.track}/>
  <film:Track source={mix.audio}/>
</film:Film>
<render:Video id="final" composition={main.composition} timeline={program.timeline}/>
```
对应导入：time=timeline-author，space=spatial，asset=media，pipe=media-pipeline，media=media-track，typo=typography-track，sound=audio-track，film=film，render=render-hyperframes，均为 @hypit/包名@1。

render.svrun：
```xml
<?svml using="@hypit/run-markup@1"?>
<svrun version="1"><author source="./main.svml"/><target output="final.video"/></svrun>
```
改了 render ID 或输出名时，SVRun target 与工程 options.target 必须同步。新增音频处理产物使用新的文件名，不覆盖历史工程引用的旧文件。

普通字幕用 typo:Area/Point 的 at / for 接收真实 alignment 时序；语义字幕读 packages/caption-track 的 README 及 prepare_hypit_speech 返回的接入用法，不猜文档路径。当前列目录用 list_hypit_components，文档由 read_hypit_docs 读取；只对不熟悉的新组件查文档。

## 取段与字幕：已在实际成片验证
视频取段用样式中的 trim-start / trim-end（帧，按工程 clock 换算），不要给 media:Item 猜 trim 属性。space:Frame 同时给 left/top/right/bottom。字幕区域、字号按画布比例调整；1080×1920 可先用约54px常规字，必须检查实际画面，不套用品牌斜体字体。

```xml
<typo:Style id="caption-style" recipe={look.text.caption} font={sans}>
  <typo:Box target="line" color="#101820AA" padding="9 22" radius="16"/>
  <typo:Fill color="#FFFFFF"/>
</typo:Style>
```
```css
text.caption { size: 54; weight: 400; align: center; block-align: center; stack-order: 20; }
```
这些绘制层按声明顺序叠加，最后的 Fill 保证字心可读。不要在白字之后叠深色描边，不以合成粗体修复低对比。先底衬后白字已验证；其他描边方案按需另行预览。typo:Area 使用真实 alignment 的 at / for，不把内容放进错误的 flow。字幕区域避开右侧平台操作栏与底部说明，不遮挡手部商品。
