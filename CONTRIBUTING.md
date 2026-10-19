# 添加与整理收藏

可以提交 [Issue](https://github.com/LinZY874/add/issues/new/choose)，也可以修改 [`content/library.json`](content/library.json) 后提交 Pull Request。

## 一条有用的收藏

至少说明标题、分类、内容或原始链接。尽量补充“为什么值得留”和“以后能怎么用”，以及作者、适用工具、学习前提或风格特点。来源尚未检查时，在 `notes` 中写明待核实。

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定且唯一的英文小写标识，建议使用短横线连接 |
| `type` | `prompt`、`image` 或 `tutorial` |
| `title` | 方便检索的标题 |
| `summary` | 一两句说明素材内容与价值 |
| `tags` | 字符串数组，优先复用现有标签 |
| `createdAt` | 首次收藏日期，格式 `YYYY-MM-DD` |
| `source` | 可选的来源对象，包含 `url`，可补 `title`、`author` |
| `content` | 可选的提示词原文、摘记或详细说明 |
| `image` | 可选对象，包含 `src` 与描述性的 `alt` |
| `gallery` | 可选的多图数组；每张包含 `src`、`alt`、`role`（`reference`／`result`），可补 `caption` |
| `generation` | 可选对象，`model` 保存用户记录的使用模型名称 |
| `notes` | 可选的收藏理由、使用场景、授权说明与待核实事项 |
| `topics` | 可选的主题数组，用于组织长期方向 |
| `related` | 可选的关联条目 ID 数组 |
| `status` | 可选，`inbox`（待整理）、`organized`（已整理）、`used`（已使用） |

提示词必须包含 `content`，教程必须包含 `source`。图片可以附上获得公开使用许可的 `image`；仅收藏图片来源时保留 `source` 与风格笔记。

一组参考图与生成结果可以作为一条风格收藏：`image` 设置列表封面，`gallery` 保存全部图片及其角色，`generation.model` 记录模型，`content` 保留完整提示词。网页、JSON 与 Markdown 会同时保留这组关系。

## 用模板添加

选择一个模板，复制到仓库之外或临时目录；把所有示例文字和 `example.com` 链接替换成真实材料，再执行导入。模板本身不会被构建成收藏。

```sh
cp templates/tutorial.example.json /tmp/my-tutorial.json
# 编辑 /tmp/my-tutorial.json 后执行：
node scripts/add.mjs --file /tmp/my-tutorial.json
npm run validate
npm run build
npm run check
```

三个模板分别是 [`prompt.example.json`](templates/prompt.example.json)、[`image.example.json`](templates/image.example.json) 和 [`tutorial.example.json`](templates/tutorial.example.json)。导入前确认没有重复的来源或内容。关联条目的 ID 必须已经存在，新增时可先省略 `related`。

直接编辑时，将条目加入 `items` 数组并更新顶层 `updatedAt`。图片文件放在 `site/assets/images/`，文件名使用英文字母、数字、短横线或下划线；`image.src` 写为 `assets/images/my-reference.webp`，不加 `/add/` 前缀。提交内容源、合法使用的素材及 `docs/` 构建结果。

## 公开素材规则

- 提示词尽量保留原文，把整理笔记写在 `notes`，并注明原始出处。
- 教程优先保存原始链接与自己的摘要，不复制完整付费课程或未经授权的长篇内容。
- 图片保留作者与来源，确认允许转载才上传；不能确认时只保存来源链接和风格描述。
- 不添加密钥、私人联系方式、私密链接或其他不适合公开的信息。
- 不把模板示例、未经验证的推测或虚构的使用效果当作真实收藏。

网页上的内容依赖仓库构建与 GitHub Pages 发布。提交 Issue 后不会自动进入网站；内容合并并发布后，JSON 与 Markdown 调用地址才会同步更新。
