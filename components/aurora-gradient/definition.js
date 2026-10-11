export const definition={
  "name": "极光流动",
  "category": "粒子光效",
  "description": "柔和色带像极光一样缓慢流动，标题在光里浮现。",
  "image": false,
  "packageName": "@frame/aurora-gradient",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "安静，也有力量"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "给内容一个呼吸的背景"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#060b16"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f1f5ff"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#36e2b4"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#7b5cff"
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
