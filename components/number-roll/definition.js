export const definition={
  "name": "数字跃升",
  "category": "数据图表",
  "description": "关键数字渐进计数，刻度与进度线共同形成落点。",
  "image": false,
  "packageName": "@frame/number-roll",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "效率提升"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "每一次进步，都看得见"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#17222d"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f2eee6"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ff9f64"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#4b657a"
    },
    {
      "key": "value",
      "label": "目标数字",
      "type": "number",
      "default": 128,
      "min": 0,
      "max": 1000000,
      "step": 1
    },
    {
      "key": "suffix",
      "label": "数字单位",
      "type": "text",
      "default": "%"
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
