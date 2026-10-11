export const proposal={
  kind:'proposal',claim:'让下一步亮起来',reason:'用商品参与的动作连接开场与收尾。',opening:'手指划出一道银线。',productRole:'手机点亮前行方向。',memory:'银线变成屏幕光。',endAction:'查看产品。',voiceover:'灵感，即刻出发。',duration:20,ratio:'9:16',
  scenes:[
    {id:'ref-scene-open',name:'银线开场',start:0,end:8,route:'code',visual:'银色细线划出中文排版。',product:'手机轮廓从银线中出现。',text:'灵感',voiceover:'灵感，',sfx:'轻微划线声',transition:'银线接入屏幕边缘'},
    {id:'ref-scene-end',name:'商品收尾',start:8,end:20,route:'hybrid',visual:'手机置于真实光影底片上，中文排版沿银线展开。',product:'商品图保持可辨形状。',text:'即刻出发',voiceover:'即刻出发。',sfx:'轻响',transition:''},
  ],music:'简洁电子节拍，收尾留一拍。',risks:['商品规格尚未提供，不写具体性能承诺。'],
};
export const review={kind:'review',keep:['保留银线与屏幕光的连接。'],issues:[{start:8,end:10,observation:'提供的8秒抽帧观察记载标题覆盖手机边缘；仅能确认该时间点。',evidenceType:'provided-observation',priority:'medium',minimalFix:'把标题上移，保留手机轮廓。',confidence:.8}]};
