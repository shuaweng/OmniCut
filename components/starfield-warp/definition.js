export const definition={
  "name": "星空穿梭",
  "category": "粒子光效",
  "description": "星点由静止拉成光线，镜头冲入星海后骤停揭示标题。",
  "image": false,
  "packageName": "@frame/starfield-warp",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "驶向下一站"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "速度，从这一刻开始"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#03040a"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#eaf0ff"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#9ab8ff"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#ff8a3d"
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
