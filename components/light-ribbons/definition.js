export const definition={
  "name": "光带流转",
  "category": "空间图形",
  "description": "多道柔光曲线持续变形，保留中央信息的呼吸空间。",
  "image": false,
  "packageName": "@frame/light-ribbons",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "灵感 自由流动"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "在流转中，找到新的表达"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#241d2b"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f5e9f0"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#d995c3"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#8e91c5"
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
