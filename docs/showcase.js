const samples = {
  dabao: { title: '大宝 SOD 蜜', meta: '30 秒 · 16:9 · 参考创作', description: '拿一条喜欢的美妆广告作参考，换成新的商品与表达，再把人物、产品镜头和配音剪到一起。', filename: '大宝SOD蜜-概念样片.mp4' },
  xiaomi: { title: '小米 17', meta: '20 秒 · 16:9 · 消费电子', description: '用参考视频作为起点，尝试把相似的氛围与镜头节奏，转化成手机产品的概念短片。', filename: '小米17-概念样片.mp4' },
  stride: { title: '炫迈口香糖', meta: '20 秒 · 9:16 · 竖屏快消', description: '围绕明朗、轻快的表达制作竖屏短片，观察快消场景下的镜头切换、配音和配乐能否配合起来。', filename: '炫迈口香糖-概念样片.mp4' },
  ps5: { title: 'PlayStation 5', meta: '15 秒 · 3:4 · 电梯广告', description: '在 15 秒和指定画幅里，尝试讲清游戏机的使用感受，检验短时长广告的信息取舍和成片呈现。', filename: 'PS5-概念样片.mp4' },
};

const player = document.querySelector('#sample-player');
const status = document.querySelector('#player-status');
const options = [...document.querySelectorAll('[data-sample]')];
let selected = 'dabao';

function selectSample(id) {
  if (!samples[id] || selected === id) return;
  const sample = samples[id];
  selected = id;
  player.pause();
  player.poster = `media/${id}.jpg`;
  player.querySelector('source').src = `media/${id}.mp4`;
  player.setAttribute('aria-label', `${sample.title}概念广告，${sample.meta}`);
  player.load();
  document.querySelector('#sample-title').textContent = sample.title;
  document.querySelector('#sample-meta').textContent = sample.meta;
  document.querySelector('#sample-description').textContent = sample.description;
  const download = document.querySelector('#sample-download');
  download.href = `media/${id}.mp4`;
  download.download = sample.filename;
  options.forEach(option => {
    const active = option.dataset.sample === id;
    option.classList.toggle('is-active', active);
    option.setAttribute('aria-pressed', String(active));
  });
  status.textContent = '';
}

options.forEach(option => option.addEventListener('click', () => selectSample(option.dataset.sample)));
document.querySelectorAll('video').forEach(video => {
  video.addEventListener('play', () => {
    document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); });
    status.textContent = '';
  });
});
player.addEventListener('error', () => {
  status.textContent = '这条视频暂时没能播放。可以点“下载样片”打开原文件。';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) player.pause();
});
