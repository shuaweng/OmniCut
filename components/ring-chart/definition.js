export const definition={
  "name": "环形占比",
  "category": "数据图表",
  "description": "圆弧绘出占比，数字与说明位于环心。",
  "image": false,
  "packageName": "@frame/ring-chart",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "专注 核心"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "把复杂信息化为清晰比例"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#eeebe5"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#292a32"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#8770cb"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#cdc8d6"
    },
    {
      "key": "value",
      "label": "占比百分数",
      "type": "number",
      "default": 76,
      "min": 0,
      "max": 100,
      "step": 1
    },
    {
      "key": "label",
      "label": "环心说明",
      "type": "text",
      "default": "达成率"
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
