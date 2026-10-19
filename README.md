# add · 灵感收藏夹

把值得留下的提示词、风格化图片和教程链接，整理成可以回看、检索与复用的个人素材库。

[打开网站](https://linzy874.github.io/add/) · [提交一条收藏](https://github.com/LinZY874/add/issues/new/choose)

仓库和网站均为公开内容。`templates/` 中的示例不会进入网站。

## 收藏什么

| 分类 | 保存的内容 | 以后如何使用 |
| --- | --- | --- |
| 提示词 | 提示词原文、适用场景、可替换参数、出处 | 直接复制，改写成自己的工作模板 |
| 风格化图片 | 图片或引用、风格特征、作者与来源 | 查找构图、配色、材质和视觉方向 |
| 教程链接 | 原始链接、主题、关键收获、学习笔记 | 按主题回看，组合成学习与制作路径 |

每条收藏都有标签、主题和状态。`inbox` 表示待整理，`organized` 表示已整理，`used` 表示已经用过。关联条目通过 `related` 的 ID 连接，方便把零散积累组织成系列。

## 以后怎么添加

继续把链接、提示词文本或图片发给协作助手，说明“放进 add 收藏夹”即可。可以再附一句“为什么值得留”或“以后想用来做什么”；暂时没有这些信息也可以先收进待整理。

助手会保留原始内容与出处，补充摘要、标签和使用场景，检查重复后写入仓库。无法读取的链接会标注待核实，不会编造正文。上传图片前会检查它是否适合公开发布；只分享参考来源时，可以仅保存链接和笔记。

也可以通过 [GitHub Issue](https://github.com/LinZY874/add/issues/new/choose) 提交素材。Issue 是收集入口，需要整理进内容库后才会出现在网站上。

## 内容文件与调用

唯一内容源是 [`content/library.json`](content/library.json)。图片文件放在 `site/assets/images/`；条目的 `image.src` 使用相对于网站根目录的路径，例如 `assets/images/my-reference.webp`。图片文件名使用英文字母、数字、短横线或下划线。

网站发布后可直接读取：

| 地址 | 用途 |
| --- | --- |
| [`data/library.json`](https://linzy874.github.io/add/data/library.json) | 完整收藏数据 |
| [`api/library.json`](https://linzy874.github.io/add/api/library.json) | 完整收藏数据的静态 API 地址 |
| `api/items/<id>.json` | 按条目 ID 读取 JSON |
| `entries/<id>.md` | 按条目 ID 读取 Markdown |

这些是随网站构建生成的静态文件。无需 API 密钥；新增收藏后，需要构建并发布才会更新。条目尚未创建时，对应的单条地址不会存在。

```js
const library = await fetch('https://linzy874.github.io/add/api/library.json')
  .then(response => response.json());
const prompts = library.items.filter(item => item.type === 'prompt');
```

## 本地维护

需要 Node.js 20 或更新版本，无需安装第三方依赖。

```sh
# 先复制模板并把示例全部替换成真实内容，再添加。
cp templates/prompt.example.json /tmp/my-prompt.json
node scripts/add.mjs --file /tmp/my-prompt.json

# 校验并生成网站与可调用数据。
npm run validate
npm run build
npm run check

# 预览构建结果。
python3 -m http.server 4173 --directory docs
```

打开 `http://localhost:4173` 查看。将内容源与构建结果一同提交到 `main`，GitHub Pages 从 `main` 分支的 `/docs` 发布。完整字段及整理约定见 [CONTRIBUTING.md](CONTRIBUTING.md)；协作助手应先阅读 [AGENTS.md](AGENTS.md)。

## 来源与使用权

公开可访问不等于可以复制或再发布。收藏条目应保留作者、原始链接及已知的授权条件；没有明确转载许可的图片优先保存来源链接。第三方内容的权利属于原作者，收藏不改变其授权范围。
