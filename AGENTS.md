# add 协作约定

本仓库是用户的长期公开收藏夹，分为提示词（`prompt`）、风格化图片（`image`）和教程链接（`tutorial`）。用户后续发来素材并要求收藏时，应完成整理、校验、构建，并在授权范围内提交发布。

## 唯一内容源

- 只编辑 `content/library.json` 作为收藏数据源，结构为 `{ "version": 1, "updatedAt": "YYYY-MM-DD", "items": [] }`。
- 不把示例、演示、占位内容或助手臆造的内容加入真实收藏。`templates/` 仅用来说明格式。
- `docs/`、JSON API 与 Markdown 条目均为构建产物，不在生成文件里手工维护收藏。
- 原始图片文件放在 `site/assets/images/`，文件名使用英文字母、数字、短横线或下划线；`image.src` 使用相对于网站根目录的 `assets/images/…` 路径。避免把用户的私有本地路径写入公开数据。

## 收到新素材后的流程

1. 读取现有内容，按原始 URL、标题和内容检查重复。相同素材补充现有条目；不同用途可用 `related` 关联。
2. 查看用户提供的原文、图片或来源页面，保存准确的出处。无法读取时，只整理已知信息，在 `notes` 明确“来源待核实”；不要编造教程正文、作者、效果或授权信息。
3. 保留可复用的原文与上下文：它是什么、为什么值得留、适合什么场景、如何再次使用。区分原文与整理笔记；用户未说明的收藏理由不可写成用户观点。
4. 使用稳定且唯一的英文小写 ID，例如 `prompt-product-photo-20261015`。类型只能是 `prompt`、`image`、`tutorial`。标题与说明优先使用中文，专有名词和提示词原文保留原语言。
5. 填写真实日期、简短摘要、标签及已知来源。有明确主题时补 `topics`；未经充分整理的条目设为 `inbox`，整理完成可设为 `organized`。只有明确实际使用过才设 `used`。
6. 公开前检查敏感信息与发布权限。不要公开密钥、个人联系方式、私密链接或用户未授权公开的材料。对第三方图片记录作者及许可；缺乏转载依据时只保存来源链接和描述，不擅自复制图片文件。
7. 使用 `node scripts/add.mjs --file <条目.json>` 添加，或谨慎编辑内容源。更新顶层 `updatedAt`，依次运行 `npm run validate`、`npm run build` 和 `npm run check`，检查新条目及构建产物。
8. 若用户已授权更新 GitHub，提交内容与构建结果并推送；返回收藏标题、分类和可访问链接。若当前会话没有可用 GitHub 权限，保留本地完成的结果并如实说明。

## 条目结构

通用必填字段：`id`、`type`、`title`、`summary`、`tags`（字符串数组）、`createdAt`（`YYYY-MM-DD`）。提示词还需 `content`，教程还需 `source`；图片应保留 `image` 或可以追溯的 `source`。

可选字段：

- `source`: `{ "url": "https://…", "title": "来源标题", "author": "作者" }`。
- `content`: 提示词原文、教程摘记或详细内容的字符串；不要把长篇受限原文整体复制进仓库。
- `image`: `{ "src": "assets/images/example.webp", "alt": "图片内容说明" }`，也可使用允许公开引用的 HTTPS 图片地址。
- `gallery`: 同一条收藏的多图数组，每张包含 `src`、`alt`、`role`（`reference` 为参考图，`result` 为生成结果），可补 `caption`。用户要求合并的参考图与成品放在一条收藏中，`image` 仅作为列表封面。
- `generation`: `{ "model": "用户提供的模型名称" }`。忠实记录用户说明，不推断实际的底层图像模型；提示词原文保存在 `content`。
- `notes`: 收藏原因、适用场景、许可说明、待核实事项及使用记录。
- `related`: 已存在的其他条目 ID 数组。
- `status`: `inbox`、`organized` 或 `used`。
- `topics`: 主题字符串数组。

尽量延续现有标签，避免只有写法不同的重复标签。没有来源、作者或许可信息时省略对应字段并如实记录，不填伪造的占位值。

## 内容调用

构建生成 `data/library.json`、`api/library.json`、`api/items/<id>.json` 和 `entries/<id>.md`。引用这些地址前，应确认条目已经构建并完成发布。尽量保持 ID 稳定，以免破坏外部引用。
