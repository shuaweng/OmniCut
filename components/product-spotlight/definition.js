export const definition={
  "name": "产品聚光",
  "category": "界面产品",
  "description": "柔和光束聚焦中央产品，信息线在两侧揭示。",
  "image": true,
  "packageName": "@frame/product-spotlight",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "让日常 发光"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "一束光，照见生活的细节"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#191f1d"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f2efe5"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#d2bf88"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#4d6557"
    },
    {
      "key": "productName",
      "label": "示意产品标签",
      "type": "text",
      "default": "日常之光"
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
