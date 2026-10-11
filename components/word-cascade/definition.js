export const definition={
  "name": "词语瀑布",
  "category": "文字排版",
  "description": "关键词依次从上方落下、回弹、堆成一段宣言。",
  "image": false,
  "packageName": "@frame/word-cascade",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "词语瀑布"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "每个词都有分量"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#f2efe8"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#191919"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ff6a22"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#b9b2a5"
    },
    {
      "key": "words",
      "label": "词语（逗号分隔，最后一个为重点）",
      "type": "text",
      "default": "灵感,素材,剪辑,声音,动效,一键成片"
    },
    {
      "key": "x",
      "label": "水平位置 %",
      "type": "number",
      "default": 50,
      "min": -50,
      "max": 150,
      "step": 1
    },
    {
      "key": "y",
      "label": "垂直位置 %",
      "type": "number",
      "default": 50,
      "min": -50,
      "max": 150,
      "step": 1
    },
    {
      "key": "scale",
      "label": "整体缩放",
      "type": "number",
      "default": 1,
      "min": 0.25,
      "max": 2,
      "step": 0.05
    },
    {
      "key": "speed",
      "label": "动作速度",
      "type": "number",
      "default": 1,
      "min": 0.25,
      "max": 3,
      "step": 0.1
    },
    {
      "key": "intensity",
      "label": "运动幅度",
      "type": "number",
      "default": 1,
      "min": 0,
      "max": 2,
      "step": 0.1
    },
    {
      "key": "transparent",
      "label": "透明背景 true / false",
      "type": "text",
      "default": "false"
    },
    {
      "key": "z",
      "label": "图层顺序",
      "type": "number",
      "default": 50,
      "step": 1
    }
  ]
};
