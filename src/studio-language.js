// Presentation-only translations. IDs, authored text, source, values, units and
// mutation targets stay canonical, so the original editor still owns all edits.
const words={
 Left:'左',Right:'右',Top:'上',Bottom:'下',Width:'宽度',Height:'高度',Placement:'位置',Frame:'边界',Fit:'画面适配',Image:'图像',Opacity:'不透明度',Blur:'模糊',Brightness:'亮度',Contrast:'对比度',Saturation:'饱和度',Hue:'色相',Scale:'缩放',Rotation:'旋转',Rotate:'旋转',Anchor:'锚点',Position:'位置',Transform:'变换',Geometry:'形状',Clip:'裁切',Radius:'圆角',Layout:'布局',Size:'尺寸',Typography:'字体',Weight:'字重',Family:'字体',Color:'颜色',Background:'背景',Align:'水平对齐','Block Align':'垂直对齐',Area:'区域',Stack:'层级','Stack Order':'图层顺序',Stacking:'图层顺序',
 Playback:'播放方式','Trim Start':'素材入点','Trim End':'素材出点',Trim:'裁剪',Gain:'音量','End Gain':'结束音量','Audio Gain':'原声音量',Mix:'混音','Fade In':'淡入','Fade Out':'淡出',Fade:'淡入淡出',Rate:'播放速度','Min Rate':'最低速度','Max Rate':'最高速度',Speed:'速度',Loop:'循环',Duration:'时长',Start:'开始',End:'结束',Offset:'偏移',Delay:'延迟',Range:'时间范围',Segment:'片段',Content:'内容',Style:'样式',Sound:'声音',Audio:'声音',Performance:'画面',Timeline:'时间线',Media:'素材',Text:'文字',Copy:'文案',Title:'标题',Subtitle:'副标题',Label:'标签',Cue:'字幕段',Captions:'字幕',Padding:'内边距',Margin:'外边距',Border:'边框',Shadow:'阴影',Outline:'描边',Spacing:'间距','Letter Spacing':'字间距','Line Height':'行高','Font Size':'字号','Font Family':'字体','Font Weight':'字重','Text Align':'文字对齐',
 'Source Extent':'素材范围','Until Boundary':'播放至边界',Boundary:'边界',Entrance:'入场',Exit:'离场',Animation:'动画',Motion:'动效',Easing:'缓动',Trigger:'触发',Event:'事件',Item:'项目',Items:'项目',Rank:'排名',Ranking:'排行',Reveals:'揭晓','Tier Board':'分级榜单','Ranking Sounds':'排行音效',Tier:'层级',Entry:'入场方式',Stroke:'描边',Fill:'填充',Intensity:'强度',Round:'圆角',RadiusX:'横向圆角',RadiusY:'纵向圆角',
 contain:'完整显示',cover:'铺满画面','fit-width':'适应宽度','fit-height':'适应高度',native:'原始尺寸','scale-down':'仅缩小',stretch:'拉伸',none:'无',rect:'矩形',rounded:'圆角',ellipse:'椭圆',circle:'圆形',left:'左对齐',right:'右对齐',center:'居中',start:'起始',end:'末尾',top:'顶部',bottom:'底部',justify:'两端对齐',normal:'常规',bold:'粗体',italic:'斜体',direct:'直接出现',drop:'落入',once:'播放一次','once-start':'从头播放一次','once-end':'末尾对齐播放',loop:'循环播放','loop-start':'从头循环播放','loop-end':'末尾对齐循环',
 'Placed interval; the end frame is exclusive.':'片段占用的时间范围，不含结束帧。',
 "Resolved Use interval; the end frame is exclusive. Timeline gestures follow this Use's author timing.":'片段在时间线上的范围，不含结束帧。',
 'Rates are multipliers (1 = original speed). Stretch requires both rate bounds.':'1 为原速；拉伸需设置最低与最高速度。',
 'Scales the source into the fitting area left inside the Frame after border and padding.':'素材在边框与内边距以内的缩放方式。',
 'Sets how opaque the sampled picture is drawn.':'调整画面的不透明度。',
 'Blurs the sampled picture by a pixel radius.':'按像素设置模糊半径。',
 'Scales the brightness of the sampled picture.':'调整画面亮度。',
 'Scales the contrast of the sampled picture.':'调整画面对比度。',
 'Scales the saturation of the sampled picture.':'调整画面饱和度。',
 'Starts timed material at this whole frame of its own timeline, and is written with `trim-end`.':'素材开始播放的位置，与素材出点共同决定截取范围。',
 'Ends timed material before this whole frame of its own timeline, and is written with `trim-start`.':'素材停止播放的位置，与素材入点共同决定截取范围。',
 "Sets this unit's absolute stacking order in the Film, higher drawing in front.":'数值越大，图层越靠前。',
 'Decides how the picture is clipped to the Frame.':'画面边缘的裁切形状。',
 'Rounds the clipped corners by a pixel radius, and is read only for a `rounded` clip.':'圆角裁切的半径，单位为像素。',
 "Fixes where the text drawn in this Style sits in the Track's paint order.":'文字在图层中的前后顺序。',
 'Sets the type size in pixels, which must be positive.':'字号，单位为像素。',
 'Sets the font weight, as a whole number from 1 to 1000.':'字重，1 至 1000 的整数。',
 'Aligns the text along the inline axis.':'文字的水平对齐方式。',
 'Aligns the text along the block axis.':'文字的垂直对齐方式。',
 'This Style is shared by every Use that selects it.':'修改将应用于所有使用此样式的片段。',
 'The referenced Style is shared by every Use that selects it.':'修改将应用于所有使用此样式的片段。'
};
export const studioText=value=>typeof value==='string'?(words[value]??value):value;
export function localizeParameter(field){
 const localized={...field,label:studioText(field.label)};
 if(field.label==='Size'&&(field.binding==='style.size'||field.page?.id==='typography'))localized.label='字号';
 for(const key of ['page','section'])if(field[key])localized[key]={...field[key],label:studioText(field[key].label)};
 if(field.summary)localized.summary=studioText(field.summary);
 if(field.options)localized.options=field.options.map(option=>typeof option==='object'&&option!==null?{...option,label:studioText(option.label)}:{value:option,label:studioText(String(option))});
 return localized;
}
const tracks={'picture.visual':'画面','captions.track':'字幕','mix.audio':'声音','music.audio':'配乐','voice.audio':'旁白','sound.audio':'声音','performance.visual':'画面','voice-sound.audio':'旁白','effects.audio':'音效','titles.track':'标题',picture:'画面',captions:'字幕',mix:'声音',music:'配乐',effects:'音效',titles:'标题',Sound:'旁白',Timeline:'时间线'};
export function studioClipTitle(value){
 if(typeof value!=='string'||/[\u3400-\u9fff]/.test(value))return value;
 const name=value.match(/^shot[-_]?([0-9]+)$/i);if(name)return '镜头 '+Number(name[1]);
 return ({voice:'旁白','voice-level':'旁白音量',endcard:'品牌尾板','bgm-head':'前段配乐','bgm-tail':'收尾配乐','fx-breeze':'环境风声','fx-cap':'开盖音效','fx-lotion':'乳液音效','caption-style':'字幕样式','caption-hidden':'字幕留白','brand-title':'品牌名称','brand-sub':'品牌文案'})[value]??value;
}
export function localizeStudioSnapshot(snapshot){
 if(snapshot.semantic?.presentation?.label)snapshot.semantic.presentation.label=studioText(snapshot.semantic.presentation.label);
 for(const track of snapshot.tracks||[]){
  track.label=tracks[track.label]??studioText(track.label);
  if(track.binding?.label)track.binding={...track.binding,label:tracks[track.binding.label]??track.binding.label};
  for(const clip of track.clips||[]){if(clip.display?.title)clip.display={...clip.display,title:studioClipTitle(clip.display.title)};if(clip.inspector)clip.inspector=clip.inspector.map(localizeParameter);}
 }
 return snapshot;
}
