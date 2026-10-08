const samples = {
  dabao: { title: '大宝 SOD 蜜', meta: '30 秒 · 16:9 · 参考创作', description: '拿一条喜欢的美妆广告作参考，换成新的商品与表达，再把人物、产品镜头和配音剪到一起。', filename: '大宝SOD蜜-概念样片.mp4' },
  'estee-lauder': { title: '雅诗兰黛眼霜', meta: '30 秒 · 16:9 · 美妆表达', description: '从美妆参考片的氛围出发，把人物、眼部细节和产品特写组织成一条 30 秒短片，验证参考改编与持续剪辑的流程。', filename: '雅诗兰黛眼霜-概念样片.mp4' },
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
