export const definition={
  "name": "玻璃卡片",
  "category": "界面产品",
  "description": "磨砂玻璃卡片在流动色块前错层浮起，边缘高光流转。",
  "image": false,
  "packageName": "@frame/glass-cards",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "通透的界面"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "层次、光与秩序"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#0e1015"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f3f5fa"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#8fa8ff"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#ff8bd1"
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
