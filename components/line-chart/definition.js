export const definition={
  "name": "曲线进度",
  "category": "数据图表",
  "description": "折线沿路径绘出，节点与终点标签逐步显现。",
  "image": false,
  "packageName": "@frame/line-chart",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "持续 向前"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "把每一个节点连成未来"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#162025"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#eef4ee"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#97dfb6"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#55726b"
    },
    {
      "key": "values",
      "label": "趋势数据（逗号分隔）",
      "type": "text",
      "default": "12,27,22,52,61,93"
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
