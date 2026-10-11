export const definition={
  "name": "无限推进",
  "category": "空间图形",
  "description": "镜头不停穿过层层相框，每层都把下一层带进来。",
  "image": false,
  "packageName": "@frame/infinite-zoom",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "更深一层"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "每一次推进都有新发现"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#111111"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#f5f5f5"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#ff6a22"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#3a3a3a"
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
