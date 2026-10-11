export const definition={
  "name": "墨迹晕染",
  "category": "转场遮罩",
  "description": "墨滴落下在宣纸上晕开，墨色铺满后留出标题与印章。",
  "image": false,
  "packageName": "@frame/ink-spread",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "墨染山河"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "一滴墨，晕开一个世界"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#f5f1e8"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#1c1b19"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#b0342c"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#8a857a"
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
