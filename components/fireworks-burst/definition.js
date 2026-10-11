export const definition={
  "name": "烟花绽放",
  "category": "粒子光效",
  "description": "多枚烟花依次升空、绽放、受重力下坠拖出光尾。",
  "image": false,
  "packageName": "@frame/fireworks-burst",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "新年快乐"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "愿所有美好如期而至"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#070912"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#fff6e8"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ffb347"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#ff4f81"
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
