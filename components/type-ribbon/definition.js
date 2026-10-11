export const definition={
  "name": "滚动字带",
  "category": "文字排版",
  "description": "两条倾斜字带反向流动，中心主张独立保持。",
  "image": false,
  "packageName": "@frame/type-ribbon",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "创造下一种可能"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "让观点拥有流动的背景"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#132126"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#ecf3e8"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#79d5bc"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#476d70"
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
