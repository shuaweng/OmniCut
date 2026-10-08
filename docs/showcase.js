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

const screenshots = {
  'reference-workbench': { label: '参考拆解', title: '先弄明白，喜欢这条参考片的什么。', description: '把参考片拆成分镜和时间点，再和 Agent 讨论哪些感觉要保留、哪些内容换成自己的。', alt: '参考视频拆解页面，展示整理后的分镜与时间点' },
  'asset-library': { label: '项目素材', title: '刚生成的、自己上传的，都在这里。', description: '找到已经满意的图、视频和声音，接着用进当前这条片子，不用再往几个工具里来回搬。', alt: '项目素材库，汇集当前项目的图片、视频与声音素材' },
  'timeline-inspector': { label: '精确剪辑', title: '差半秒的地方，自己也能动手调。', description: '选中片段，看画面、调时间线和参数；手动改完以后，Agent 还能顺着同一份工程继续做。', alt: '视频工作台中的时间线、画面预览与选中片段的编辑参数' },
  'creative-subagent': { label: '创意子代理', title: '创意是怎么想出来的，可以点进去看。', description: '打开创意子代理的讨论，看看文案和分镜的来由，再把自己的修改意见说清楚。', alt: '创意子代理详情，展示创意讨论、文案与分镜内容' },
  'model-settings': { label: '模型设置', title: '画面、声音和创意，按任务选模型。', description: '在同一处配置图片、视频、配音和配乐服务，质量与成本怎么取舍，由自己决定。', alt: '模型设置页面，按任务配置图片、视频、声音和创意服务' },
  'export-preview': { label: '成片预览', title: '完整看一遍，才知道哪里还要改。', description: '把画面、字幕和声音放在一起看；满意就拿走成片，不满意就回到这个项目接着修改。', alt: '成片预览页面，查看当前项目导出的完整视频' },
};

const screenshotChoices = [...document.querySelectorAll('[data-screenshot]')];
const screenshotImage = document.querySelector('#tour-image');
const screenshotLink = document.querySelector('#tour-image-link');
const screenshotOriginal = document.querySelector('#tour-original');
const screenshotStatus = document.querySelector('#tour-status');
let selectedScreenshot = 'reference-workbench';

function selectScreenshot(id) {
  const screenshot = screenshots[id];
  if (!screenshot || selectedScreenshot === id) return;
  selectedScreenshot = id;
  const file = `media/${id}.jpg`;
  screenshotStatus.textContent = '';
  screenshotLink.classList.add('is-loading');
  screenshotLink.setAttribute('aria-busy', 'true');
  screenshotImage.src = file;
  screenshotImage.alt = screenshot.alt;
  screenshotLink.href = file;
  screenshotLink.setAttribute('aria-label', `查看${screenshot.label}截图原图，在新标签页打开`);
  screenshotOriginal.href = file;
  document.querySelector('#tour-caption-title').textContent = screenshot.title;
  document.querySelector('#tour-caption-text').textContent = screenshot.description;
  screenshotChoices.forEach(choice => {
    const active = choice.dataset.screenshot === id;
    choice.classList.toggle('is-active', active);
    choice.setAttribute('aria-pressed', String(active));
  });
}

screenshotChoices.forEach((choice, index) => {
  choice.addEventListener('click', () => selectScreenshot(choice.dataset.screenshot));
  choice.addEventListener('keydown', event => {
    const destination = event.key === 'ArrowRight' ? (index + 1) % screenshotChoices.length
      : event.key === 'ArrowLeft' ? (index - 1 + screenshotChoices.length) % screenshotChoices.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? screenshotChoices.length - 1 : null;
    if (destination === null) return;
    event.preventDefault();
    screenshotChoices[destination].focus();
    selectScreenshot(screenshotChoices[destination].dataset.screenshot);
  });
});
screenshotImage.addEventListener('load', () => {
  screenshotLink.classList.remove('is-loading');
  screenshotLink.removeAttribute('aria-busy');
});
screenshotImage.addEventListener('error', () => {
  screenshotLink.classList.remove('is-loading');
  screenshotLink.removeAttribute('aria-busy');
  screenshotStatus.textContent = '这张截图暂时没打开，可以试试“查看原图”。';
});
