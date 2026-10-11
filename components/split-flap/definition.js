export const definition={
  "name": "翻牌字幕",
  "category": "文字排版",
  "description": "机场翻牌逐格翻动，字符依次停在答案上。",
  "image": false,
  "packageName": "@frame/split-flap",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "NEW 2026"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "即将登场"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#111111"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f4f1ea"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ffb627"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#2a2a2a"
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
