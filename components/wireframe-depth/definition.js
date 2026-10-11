export const definition={
  "name": "线框空间",
  "category": "空间图形",
  "description": "线框立方体持续旋转，投影与空间网格构成深度。",
  "image": false,
  "packageName": "@frame/wireframe-depth",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "看见 新维度"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "将结构，转化为清晰的空间"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#15272d"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#e7f1ef"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#8bdbd6"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#335b68"
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
