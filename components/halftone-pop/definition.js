export const definition={
  "name": "半调波普",
  "category": "几何图形",
  "description": "波普网点涌动扩散，粗描边标题像漫画对白框一样弹出。",
  "image": false,
  "packageName": "@frame/halftone-pop",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "就是现在！"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "限时登场"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#ffe14d"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#111111"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ff3c38"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#1f6feb"
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
