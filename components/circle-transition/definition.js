export const definition={
  "name": "圆形转场",
  "category": "转场遮罩",
  "description": "圆形窗口从中央扩张，环线与标题共同完成揭示。",
  "image": true,
  "packageName": "@frame/circle-transition",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "新的可能 正在展开"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "从一点开始，让画面完整出现"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#eeeae2"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#332e3d"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#9885bf"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#d5cadd"
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
