# 常规镜头广告：结构化编排，同一个 Hypit 工程
新片的素材齐备后优先 compose_video，不需要 checkout、逐个 stage/copy、写 SVML 或重复查包文档。它验证素材真实类型/时长、批量同步媒体、生成标准 Hypit 源码、编译并保存。不是用户看到的初始模板，不会预填镜头。

调用 composition 为 JSON 字符串；revision 来自 get_project_context。下面仅为字段示例，时长、文字和文件名必须使用本次实际结果：
```json
{
  "output":{"width":1080,"height":1920,"fps":24},
  "duration":10,
  "shots":[
    {"id":"opening","name":"开场商品","assetFile":"实际视频UUID.mp4","start":0,"duration":4,"trimStart":0.5},
    {"id":"detail","name":"产品细节","assetFile":"另一个实际视频UUID.mp4","start":4,"duration":6}
  ],
  "audio":[
    {"id":"voice","name":"中文旁白","assetFile":"实际配音UUID.mp3","role":"narration","start":0.5,"duration":8,"gain":1},
    {"id":"music","name":"背景配乐","assetFile":"实际音乐UUID.mp3","role":"music","start":0,"duration":10,"gain":0.2,"fadeOut":0.4}
  ],
  "captions":[{"audioId":"voice","phrases":["实际说出的第一句","实际说出的第二句"]}],
  "texts":[{"id":"brand","name":"品牌尾板","text":"用户提供的品牌名","start":8,"duration":2,"box":[8,6,92,16],"size":72,"color":"#173C31","background":false}]
}
```
- 时间单位秒，box=[left,top,right,bottom]为画布百分比；视频默认铺满，可fit=contain。使用素材真实时长，不延长视频制造末尾黑屏。图片镜头必须显式 kind=image，只适合用户允许的图文/尾板。
- captions直接复用配音任务的真实字符/词时序；缺失时先transcribe_media。旁白取段或移动后重新计算字幕。不填均分时间。自动字幕可通过texts相应id（spoken-音轨id-序号）局部改字号/区域。
- audio支持trimStart、gain（线性0–2）、fadeIn/fadeOut、loop。gain不是响度保证，输入声音仍需实际检查。视频原声仅显式keepAudio=true时保留，与旁白/配乐避免重复。
- id使用稳定小写英文标识，name使用中文。返回的镜头、字幕和音轨仍在同一Hypit源码里，可通过Studio或代码扩展，不创建另一条渲染链路。

## 局部修改
```json
{"patch":{"audio":[{"id":"music","gain":0.16}],"shots":[{"id":"detail","assetFile":"已完成的新素材.mp4","trimStart":0}],"texts":[{"id":"brand","box":[8,4,92,14]}]}}
```
后续回到项目可用read_hypit_project读取frame-composition.json取得稳定id。只提交改变项；其他轨道、素材、字幕时序自动保留。删除对象需 remove=true，删镜头后仍须保证时间线完整。一次修改后预览目标区间，再按用户任务导出一版。

初次编排只适用于空白工程。旧工程/已手写扩展工程用 inspect_hypit_scene + edit_hypit_scene/adjust_hypit_timing，或源码做局部修改。compose_video检测到手工改动会拒绝覆盖，不能删除标记文件绕过。不要为新工具重新制作用户已完成工程。

## 代码扩展与同步
代码模式首次checkout，之后新素材完成只调用sync_hypit_assets，可批量传assetFiles或省略同步全部。返回hypit/assets相对路径、中文名、真实类型时长；冲突保留原文件并报告。不要重复checkout覆盖草稿。
代码改完commit_hypit_project。只有使用新的组件时才查对应文档。语法失败先看报错附近行和括号，避免猜测规则、堆临时测试工程。
