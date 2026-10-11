export const definition={
  "name": "果冻弹跳",
  "category": "几何图形",
  "description": "软球带着挤压与拉伸弹跳落地，每次落地都弹出一个字。",
  "image": false,
  "packageName": "@frame/jelly-bounce",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "活力满满"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "软软的，弹弹的"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#ffe8d6"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#3a2418"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ff6b6b"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#4ecdc4"
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
