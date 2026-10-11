export const definition={
  "name": "遮罩推幕",
  "category": "转场遮罩",
  "description": "两块色幕交错退场，主标题从窄缝中展开。",
  "image": false,
  "packageName": "@frame/mask-reveal",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "打开 新一幕"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "每次出发，都有新的风景"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#ede8dc"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#352d27"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#c67c52"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#c6b797"
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
