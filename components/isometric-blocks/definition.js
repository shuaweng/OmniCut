export const definition={
  "name": "等距方块",
  "category": "空间图形",
  "description": "等距方块从网格中依次升起，搭成一座小城。",
  "image": false,
  "packageName": "@frame/isometric-blocks",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "一点点搭起来"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "从基础到全貌"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#f3efe7"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#24211d"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ff7a45"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#6c8ead"
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
