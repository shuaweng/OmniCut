export const definition={
  "name": "蓝图绘制",
  "category": "几何图形",
  "description": "蓝图网格上线条逐段绘出，尺寸标注依次出现。",
  "image": false,
  "packageName": "@frame/blueprint-draw",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "精确到每一毫米"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "设计 · 结构 · 工艺"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#0f3b66"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#e8f1fb"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ffffff"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#6ea8dc"
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
