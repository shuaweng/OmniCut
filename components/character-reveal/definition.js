export const definition={
  "name": "逐字揭示",
  "category": "文字排版",
  "description": "字符沿一条弧线逐个升起，余字淡影保持读序。",
  "image": false,
  "packageName": "@frame/character-reveal",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "每一刻 都值得"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "让字句带着呼吸出现"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#f2ebe2"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#3c322b"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#a85547"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#bdb4a8"
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
