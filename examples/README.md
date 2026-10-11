# 把置顶作品带到自己的工作台

这些是 OmniCut 实际制作、导出的作品。目录里除了成片，还保留了可以继续剪辑的工程和使用到的素材。

| 项目 | 视频版本 | 可编辑工程 |
| --- | --- | --- |
| OmniCut · 创意不该困在工具里 | 原版、代码界面版，各 61 秒 | [打开工程](featured/projects/p-eea876508eae/) |
| 雅诗兰黛小棕瓶眼霜 | 30 秒 | [打开工程](featured/projects/p-c3f6a5a9eba4/) |
| 雅诗兰黛 · 把从容留给双眸 | 15 秒 | [打开工程](featured/projects/p-7934041f904c/) |
| 大宝 SOD 蜜 · 把日子润成诗 | 30 秒 | [打开工程](featured/projects/p-6edeb7d33b08/) |
| OmniCut · 让想法开口 | 31.4 秒 | [打开工程](featured/projects/p-cf0dc440b2cc/) |

[先看样片](https://shuaweng.github.io/OmniCut/#samples)，或者按下列步骤导入。

## 怎么打开

在仓库根目录安装依赖后，停止正在运行的 OmniCut，再执行：

```sh
npm run examples:import
npm start
```

另开终端执行 `npm run open`，首页就会出现五个置顶项目。宣传片项目的“当前视频”里可以切换两个版本。画面、声音、字幕和动效仍然可以编辑；查看及本地导出不需要重新调用生成模型。

导入遇到相同项目编号或成片编号时会拒绝覆盖，不会替换已有工程。导入后要重启服务，才能让已运行的服务读到这些成片。

## 包里有什么

- `featured/projects/`：当前工程、使用到的素材、原生组件、字体及对应许可。
- `featured/exports/`：六条成片，以及海报和净化后的成片记录。
- `featured/manifest.json`：项目、版本及文件索引。
- `featured/verification.json`：资源引用和公开内容检查记录。

没有带入作者的 API Key、聊天历史和供应商请求信息。查看包的完整性可执行 `npm run examples:verify`。这些是个人概念创作，品牌、字体和上游组件仍适用各自权利及许可说明。
