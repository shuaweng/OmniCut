export const parameters = [
  {key: 'accent', label: '品牌主色', type: 'color', default: '#E30613'},
  {key: 'openingLine1', label: '开场第一行（空白保留原文）', type: 'text', default: ''},
  {key: 'openingLine2', label: '开场第二行', type: 'text', default: ''},
  {key: 'posterLine1', label: '海报标题第一行', type: 'text', default: ''},
  {key: 'posterLine2', label: '海报标题第二行', type: 'text', default: ''},
  {key: 'closingLine1', label: '片尾第一行', type: 'text', default: ''},
  {key: 'closingLine2', label: '片尾第二行', type: 'text', default: ''},
  {key: 'credit', label: '品牌署名', type: 'text', default: ''},
  {key: 'sourceStart', label: '原场景起始秒', type: 'number', default: 0, min: 0, max: 44, step: 0.125},
  {key: 'rate', label: '原场景播放速率', type: 'number', default: 1, min: 0.25, max: 2, step: 0.125},
  {key: 'z', label: '图层顺序', type: 'number', default: 50, step: 1},
];
export const definition = {
  packageName: '@frame/swiss-poster', name: '瑞士海报', category: '完整场景',
  description: '网格与大字构成海报，红圆跳出秩序，版面旋转化作乐谱，再拉远成海报墙。可替换标题与品牌主色。',
  parameters,
};
