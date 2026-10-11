export const definition={
  "name": "轨道环绕",
  "category": "空间图形",
  "description": "倾斜椭圆轨道绕核心流动，卫星保留前后层级。",
  "image": false,
  "packageName": "@frame/orbital-system",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "以你 为中心"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "让每一种可能，围绕核心展开"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#192927"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f0eade"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#b6c79a"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#5e8675"
    },
    {
      "key": "label",
      "label": "中心标签",
      "type": "text",
      "default": "核心"
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
