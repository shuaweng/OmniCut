export const definition={
  "name": "指标看板",
  "category": "数据图表",
  "description": "四块指标卡依次亮起，数字滚动上升，迷你曲线随之画出。",
  "image": false,
  "packageName": "@frame/kpi-dashboard",
  "parameters": [
    {
      "key": "title",
      "label": "主标题",
      "type": "text",
      "default": "本季度成绩单"
    },
    {
      "key": "subtitle",
      "label": "说明文案",
      "type": "text",
      "default": "数据来自示例，请替换为真实值"
    },
    {
      "key": "background",
      "label": "背景颜色",
      "type": "text",
      "default": "#0f1216"
    },
    {
      "key": "color",
      "label": "文字颜色",
      "type": "text",
      "default": "#e8edf3"
    },
    {
      "key": "accent",
      "label": "主点缀颜色",
      "type": "text",
      "default": "#22d3a6"
    },
    {
      "key": "secondary",
      "label": "次点缀颜色",
      "type": "text",
      "default": "#3b4552"
    },
    {
      "key": "values",
      "label": "指标数值（逗号分隔）",
      "type": "text",
      "default": "128,86,42,99"
    },
    {
      "key": "labels",
      "label": "指标名称（逗号分隔）",
      "type": "text",
      "default": "新增用户,留存率,转化率,满意度"
    },
    {
      "key": "suffixes",
      "label": "单位（逗号分隔）",
      "type": "text",
      "default": "万,%,%,分"
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
