export const definition={
  "name": "光标点击演示",
  "category": "界面产品",
  "description": "光标移到输入框、打字、点击生成，结果卡片随之出现。",
  "image": false,
  "packageName": "@frame/cursor-click",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "输入想法，一键生成"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "三步完成创作"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#f4f5f7"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#16181d"
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
      "default": "#c9ced6"
    },
    {
      "key": "prompt",
      "label": "输入框文字",
      "type": "text",
      "default": "做一条 30 秒的新品广告"
    },
    {
      "key": "button",
      "label": "按钮文字",
      "type": "text",
      "default": "生成"
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
