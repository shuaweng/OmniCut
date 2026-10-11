export const definition={
  "name": "切片揭示",
  "category": "界面产品",
  "description": "四块画面切片交错进场，落稳后组成完整视觉。",
  "image": true,
  "packageName": "@frame/image-slices",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "拼合 每份灵感"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "碎片汇聚，完整呈现"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#ede7dc"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#3e3730"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#be7755"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#b7ba9d"
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
