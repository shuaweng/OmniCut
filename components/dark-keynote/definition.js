export const nativeFonts = [
  { id: 'inter', file: 'fonts/Inter.ttf', weight: 400, variableWeight: '100 900', style: 'normal' },
  { id: 'interTight', file: 'fonts/InterTight-var.ttf', weight: 400, variableWeight: '100 900', style: 'normal' },
  { id: 'mono', file: 'fonts/JetBrainsMono-var.ttf', weight: 400, variableWeight: '100 800', style: 'normal' },
];

export const definition = {
  name: '空间发布会',
  category: '完整场景',
  description: '纷乱界面一按归位，光扫揭幕与数字亮相，最后收成一根光标。',
  image: false,
  packageName: '@frame/dark-keynote',
  nativeFonts,
  parameters: [
    { key: 'brand', label: '品牌名（最多 8 字）', type: 'text', default: 'Tidy', maxLength: 8 },
    { key: 'accent', label: '品牌强调色', type: 'color', default: '#B7F34A' },
    { key: 'captions', label: '显示场景字幕', type: 'boolean', default: true },
    { key: 'sourceStart', label: '原片起始秒数', type: 'number', default: 0, min: 0, max: 41.999, step: 0.125 },
    { key: 'rate', label: '播放速率', type: 'number', default: 1, min: 0.25, max: 4, step: 0.05 },
    { key: 'z', label: '图层顺序', type: 'number', default: 50, step: 1 },
  ],
};
