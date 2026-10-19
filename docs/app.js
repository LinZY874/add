'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const names = { prompt: '提示词', image: '风格图片', tutorial: '教程链接' };
  const statuses = { inbox: '待整理', organized: '已整理', used: '已实践' };
  const state = { library: null, filter: 'all', query: '', tag: '', sort: 'newest', view: 'grid' };
  let toastTimer;
  let priorHash = '#library';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, small = false) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', small ? 'icon small' : 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function externalUrl(value) {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  function imageUrl(value) {
    if (typeof value !== 'string') return null;
    if (/^assets\/[A-Za-z0-9/_\-.]+$/.test(value) && !value.split('/').includes('..')) return new URL(value, document.baseURI).href;
    return externalUrl(value);
  }

  function outsideLink(url, text, className = '') {
    const link = el('a', className, text);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
  }

  async function copy(text, message = '已复制，可以继续使用了') {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
    } catch {
      const field = el('textarea');
      field.value = text;
      field.style.cssText = 'position:fixed;left:-9999px;top:0';
      const parent = $('dialog[open]') || document.body;
      parent.append(field);
      field.select();
      const success = document.execCommand('copy');
      field.remove();
      if (!success) { toast('复制未完成，请打开内容后手动复制'); return; }
    }
    toast(message);
  }

  function showDialog(id) {
    const dialog = $(`#${id}-dialog`);
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
  }

  $$('[data-open]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.open === 'export') {
      if (!state.library) { toast('收藏库还未加载完成，请稍后再试'); return; }
      const count = filteredItems().length;
      $('#export-caption').textContent = `导出当前筛选的 ${count} 条收藏，继续整理或交给 AI 使用。`;
    }
    showDialog(button.dataset.open);
  }));
  $$('dialog').forEach(dialog => {
    $('.modal-close', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!$('dialog[open]')) document.body.style.overflow = '';
      if (dialog.id === 'detail-dialog' && location.hash.startsWith('#item=')) history.replaceState(null, '', priorHash);
    });
  });

  function filteredItems() {
    const query = state.query.trim().toLocaleLowerCase();
    return (state.library?.items || []).filter(item => {
      const text = [item.title, item.summary, item.content, item.notes, item.generation?.model, item.source?.title, item.source?.author, item.source?.url, ...(item.tags || []), ...(item.topics || []), ...(item.gallery || []).map(image => `${image.caption || ''} ${image.alt}`)].filter(Boolean).join(' ').toLocaleLowerCase();
      return (state.filter === 'all' || state.filter === item.type) && (!state.tag || item.tags.includes(state.tag)) && (!query || query.split(/\s+/).every(word => text.includes(word)));
    }).sort((a, b) => {
      if (state.sort === 'title') return a.title.localeCompare(b.title, 'zh-CN');
      const dateOrder = a.createdAt.localeCompare(b.createdAt);
      return (state.sort === 'oldest' ? dateOrder : -dateOrder) || a.id.localeCompare(b.id);
    });
  }

  function renderCounts() {
    const items = state.library?.items || [];
    $('#total-count').textContent = String(items.length).padStart(2, '0');
    $$('[data-count]').forEach(node => node.textContent = `${items.filter(item => item.type === node.dataset.count).length} 条`);
    $$('[data-tab-count]').forEach(node => node.textContent = node.dataset.tabCount === 'all' ? items.length : items.filter(item => item.type === node.dataset.tabCount).length);
    if (state.library) $('#last-updated').textContent = `最近更新 ${state.library.updatedAt}`;
  }

  function setFilter(type, scroll = false) {
    state.filter = type;
    state.tag = '';
    render();
    if (scroll) $('#library').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  $$('[data-filter]').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
  $$('[data-category]').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.category, true)));
  $('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
  $('#sort').addEventListener('change', event => { state.sort = event.target.value; render(); });
  $$('[data-view]').forEach(button => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    render();
  }));
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable="true"]') && !$('dialog[open]')) {
      event.preventDefault();
      $('#search').focus();
      $('#library').scrollIntoView({ block: 'start' });
    }
  });

  function renderTags(visibleItems) {
    const root = $('#tag-filters');
    root.replaceChildren();
    const caption = el('span', '', state.library?.items.length ? `${visibleItems.length} 条灵感` : '等待第一条灵感');
    caption.id = 'result-caption';
    caption.setAttribute('role', 'status');
    caption.setAttribute('aria-live', 'polite');
    root.append(caption);
    const eligible = (state.library?.items || []).filter(item => state.filter === 'all' || item.type === state.filter);
    const tags = new Map();
    eligible.forEach(item => item.tags.forEach(tag => tags.set(tag, (tags.get(tag) || 0) + 1)));
    const mostUsed = [...tags.keys()].sort((a, b) => tags.get(b) - tags.get(a) || a.localeCompare(b, 'zh-CN')).slice(0, 10);
    if (state.tag && !mostUsed.includes(state.tag)) mostUsed.push(state.tag);
    mostUsed.forEach(tag => {
      const button = el('button', `tag-button${state.tag === tag ? ' active' : ''}`, `# ${tag}`);
      button.setAttribute('aria-pressed', String(state.tag === tag));
      button.addEventListener('click', () => {
        state.tag = state.tag === tag ? '' : tag;
        render();
        $$('.tag-button').find(node => node.textContent === `# ${tag}`)?.focus();
      });
      root.append(button);
    });
  }

  function emptyState() {
    const hasItems = !!state.library?.items.length;
    const isFiltered = state.filter !== 'all' || state.query.trim() || state.tag;
    const root = el('div', `empty-state${isFiltered ? ' no-results' : ''}`);
    const art = el('div', 'empty-art');
    art.setAttribute('aria-hidden', 'true');
    art.append(el('span', '', '✳'));
    root.append(art);
    if (hasItems || state.query.trim() || state.tag) {
      root.append(el('h3', '', '还没找到这条灵感。'), el('p', '', '换个关键词，或清除筛选再看看。'));
      const clear = el('button', 'button', '清除所有筛选');
      clear.addEventListener('click', () => {
        state.query = ''; state.tag = ''; state.filter = 'all'; $('#search').value = ''; render();
      });
      root.append(clear);
    } else {
      root.append(el('h3', '', state.filter === 'all' ? '收藏夹已就位，等你的第一条灵感。' : `还没有收录${names[state.filter]}，先留下一条吧。`));
      const desc = el('p');
      desc.append(document.createTextNode('把值得留下的内容发到与你的 AI 助手的对话里，'), el('br'), document.createTextNode('从一条链接、一段表达，或一种喜欢的风格开始。'));
      const button = el('button', 'button');
      button.append(icon('plus'), document.createTextNode('了解如何收录'));
      button.addEventListener('click', () => showDialog('collect'));
      root.append(desc, button, el('span', 'empty-corner', 'A SMALL START. A NEW POSSIBILITY.'));
    }
    return root;
  }

  function cardVisual(item) {
    const visual = el('span', `card-visual ${item.type}`);
    visual.setAttribute('aria-hidden', 'true');
    if (item.type === 'prompt') visual.append(el('span', 'card-prompt-preview', item.content));
    else if (item.type === 'image') {
      const url = imageUrl(item.image?.src);
      if (url) {
        const img = el('img');
        img.src = url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => visual.replaceChildren(el('span', 'image-placeholder', '◒')));
        visual.append(img);
      } else visual.append(el('span', 'image-placeholder', '◒'));
      if (item.gallery?.length) {
        visual.classList.add('series-cover');
        visual.append(el('span', 'gallery-count', `${item.gallery.length} 张图片`));
      }
    } else {
      let host = 'TUTORIAL';
      try { host = new URL(item.source?.url).hostname.replace(/^www\./, ''); } catch {}
      visual.append(el('small', '', host), el('span', '', '↗'));
    }
    return visual;
  }

  function card(item) {
    const article = el('article', 'collection-card');
    const open = el('button', 'card-open');
    open.setAttribute('aria-label', `查看${names[item.type]}：${item.title}`);
    open.addEventListener('click', () => openDetail(item.id));
    const body = el('span', 'card-body');
    const meta = el('span', 'card-meta');
    meta.append(el('span', `type-pill ${item.type}`, names[item.type]), el('span', '', statuses[item.status || 'inbox']));
    body.append(meta, el('h3', '', item.title), el('p', '', item.summary));
    open.append(cardVisual(item), body);
    const tags = el('div', 'card-tags');
    item.tags.slice(0, 4).forEach(tag => tags.append(el('span', '', `# ${tag}`)));
    const footer = el('div', 'card-footer');
    const copyButton = el('button');
    copyButton.setAttribute('aria-label', item.type === 'prompt' ? `复制提示词：${item.title}` : `复制收藏：${item.title}`);
    copyButton.append(icon('copy'), document.createTextNode(item.type === 'prompt' ? '复制提示词' : '复制收藏'));
    copyButton.addEventListener('click', () => copy(item.type === 'prompt' ? item.content : itemMarkdown(item)));
    footer.append(el('span', '', item.createdAt), copyButton);
    article.append(open, footer, tags);
    return article;
  }

  function render() {
    $$('[data-filter]').forEach(button => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    $$('[data-category]').forEach(button => {
      const active = button.dataset.category === state.filter;
      button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
    });
    $$('[data-view]').forEach(button => {
      const active = button.dataset.view === state.view;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    const root = $('#collection');
    root.classList.toggle('list-view', state.view === 'list');
    if (!state.library) return;
    const items = filteredItems();
    renderTags(items);
    root.replaceChildren(...(items.length ? items.map(card) : [emptyState()]));
  }

  function openDetail(id) {
    const item = state.library?.items.find(entry => entry.id === id);
    if (!item) { toast('这条收藏暂时没有找到'); return; }
    const root = $('#detail-content');
    root.replaceChildren();
    const meta = el('div', 'detail-meta');
    meta.append(el('span', `type-pill ${item.type}`, names[item.type]), el('span', '', `${item.createdAt} · ${statuses[item.status || 'inbox']}`));
    const title = el('h2', '', item.title);
    title.id = 'detail-title'; title.tabIndex = -1;
    root.append(el('div', 'eyebrow', `COLLECTION / ${item.id}`), meta, title, el('p', 'detail-summary', item.summary));
    if (item.generation?.model) {
      const generation = el('div', 'generation-meta');
      generation.append(el('span', '', '使用模型'), el('strong', '', item.generation.model));
      root.append(generation);
    }
    const gallery = item.gallery || [];
    if (gallery.length) {
      for (const [role, label] of [['reference', '参考图'], ['result', '生成结果']]) {
        const images = gallery.filter(image => image.role === role);
        if (!images.length) continue;
        const section = el('section', `detail-gallery gallery-${role}`);
        const heading = el('h3', 'detail-section-title', `${label} · ${images.length} 张`);
        heading.id = `gallery-${role}-title`;
        section.setAttribute('aria-labelledby', heading.id);
        section.append(heading);
        images.forEach((image, index) => {
          const url = imageUrl(image.src);
          if (!url) return;
          const figure = el('figure', 'gallery-figure');
          const fullSize = outsideLink(url, '', 'gallery-image-link');
          fullSize.setAttribute('aria-label', `查看原图：${image.caption || `${label} ${index + 1}`}`);
          const img = el('img', 'gallery-image');
          img.src = url; img.alt = image.alt; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          img.addEventListener('error', () => img.replaceWith(el('p', 'detail-notes', '预览暂时无法显示，请打开原图查看。')));
          fullSize.append(img);
          const caption = el('figcaption', 'gallery-caption');
          caption.append(el('span', '', image.caption || `${label} ${index + 1}`), outsideLink(url, '查看原图 ↗'));
          figure.append(fullSize, caption);
          section.append(figure);
        });
        root.append(section);
      }
    }
    const image = imageUrl(item.image?.src);
    if (image && !gallery.length) {
      const img = el('img', 'detail-image');
      img.src = image; img.alt = item.image.alt; img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.replaceWith(el('p', 'detail-notes', '图片暂时无法显示，可以通过下方来源链接查看。')));
      root.append(img);
    }
    if (item.content) {
      const contentHeading = el('div', 'detail-content-heading');
      contentHeading.append(el('h3', 'detail-section-title', item.type === 'prompt' || item.generation ? '提示词原文' : '内容与要点'));
      if (item.type !== 'prompt' && item.generation) {
        const copyPrompt = el('button', 'subtle-button');
        copyPrompt.append(icon('copy'), document.createTextNode('复制提示词'));
        copyPrompt.addEventListener('click', () => copy(item.content, '完整提示词已复制'));
        contentHeading.append(copyPrompt);
      }
      root.append(contentHeading, el('div', 'detail-content-text', item.content));
    }
    if (item.notes) root.append(el('h3', 'detail-section-title', '收藏理由与复用思路'), el('p', 'detail-notes', item.notes));
    const tags = el('div', 'detail-tags');
    [...item.tags, ...(item.topics || []).map(topic => `主题：${topic}`)].forEach(tag => tags.append(el('span', '', tag)));
    root.append(tags);
    const source = externalUrl(item.source?.url);
    if (source) {
      const line = el('p', 'source-line', '来源：');
      line.append(outsideLink(source, item.source.title || new URL(source).hostname));
      if (item.source.author) line.append(document.createTextNode(` · ${item.source.author}`));
      root.append(line);
    }
    const related = (item.related || []).map(id => state.library.items.find(entry => entry.id === id)).filter(Boolean);
    if (related.length) {
      root.append(el('h3', 'detail-section-title', '关联灵感'));
      related.forEach(entry => {
        const link = el('button', 'related-link', `${names[entry.type]} · ${entry.title} ↗`);
        link.addEventListener('click', () => openDetail(entry.id)); root.append(link);
      });
    }
    const actions = el('div', 'detail-actions');
    const copyButton = el('button', 'button button-dark');
    copyButton.append(icon('copy'), document.createTextNode(item.type === 'prompt' ? '复制提示词' : '复制收藏内容'));
    copyButton.addEventListener('click', () => copy(item.type === 'prompt' ? item.content : itemMarkdown(item)));
    const permalink = el('button', 'button button-light', '复制分享链接');
    permalink.addEventListener('click', () => copy(new URL(`#item=${encodeURIComponent(item.id)}`, location.href).href, '已复制这条收藏的链接'));
    const json = outsideLink(new URL(`api/items/${encodeURIComponent(item.id)}.json`, document.baseURI).href, 'JSON ↗', 'button button-light');
    const markdown = outsideLink(new URL(`entries/${encodeURIComponent(item.id)}.md`, document.baseURI).href, 'Markdown ↗', 'button button-light');
    actions.append(copyButton, permalink, json, markdown);
    root.append(actions);
    if (!$('#detail-dialog').open) priorHash = location.hash.startsWith('#item=') ? '#library' : (location.hash || '#library');
    history.replaceState(null, '', `#item=${encodeURIComponent(item.id)}`);
    showDialog('detail');
    title.focus({ preventScroll: true });
    $('#detail-dialog').scrollTop = 0;
  }

  function escapeMarkdown(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#+.!|])/g, '\\$1');
  }

  function fenced(value) {
    const runs = value.match(/`+/g) || [];
    const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
    return `${fence}text\n${value}${value.endsWith('\n') ? '' : '\n'}${fence}`;
  }

  function itemMarkdown(item) {
    const lines = [`## ${escapeMarkdown(item.title)}`, '', `- ID：${item.id}`, `- 类型：${names[item.type]}`, `- 收录：${item.createdAt}`, `- 状态：${statuses[item.status || 'inbox']}`, `- 标签：${item.tags.map(escapeMarkdown).join('、') || '无'}`];
    if (item.topics?.length) lines.push(`- 主题：${item.topics.map(escapeMarkdown).join('、')}`);
    if (item.generation?.model) lines.push(`- 使用模型：${escapeMarkdown(item.generation.model)}`);
    if (item.source?.url) lines.push(`- 来源：<${item.source.url.replace(/</g, '%3C').replace(/>/g, '%3E')}>`, ...(item.source.author ? [`- 作者：${escapeMarkdown(item.source.author)}`] : []));
    lines.push('', escapeMarkdown(item.summary));
    const markdownImage = image => {
      const url = imageUrl(image.src);
      return url ? `![${escapeMarkdown(image.alt)}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : '';
    };
    if (item.gallery?.length) {
      for (const [role, label] of [['reference', '参考图'], ['result', '生成结果']]) {
        const images = item.gallery.filter(image => image.role === role);
        if (!images.length) continue;
        lines.push('', `### ${label}`);
        images.forEach(image => {
          if (image.caption) lines.push('', escapeMarkdown(image.caption));
          lines.push('', markdownImage(image));
        });
      }
    } else if (item.image?.src) lines.push('', markdownImage(item.image));
    if (item.content) lines.push('', item.type === 'prompt' || item.generation ? '### 提示词原文' : '### 内容', '', fenced(item.content));
    if (item.notes) lines.push('', '### 收藏理由与复用思路', '', escapeMarkdown(item.notes));
    if (item.related?.length) lines.push('', `关联收藏：${item.related.join('、')}`);
    return `${lines.join('\n')}\n`;
  }

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = el('a');
    link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('导出文件已准备好');
  }
  $('#export-json').addEventListener('click', () => {
    if (!state.library) return;
    const items = filteredItems();
    const included = new Set(items.map(item => item.id));
    const exportedItems = items.map(item => item.related ? { ...item, related: item.related.filter(id => included.has(id)) } : item);
    download('add-collection.json', JSON.stringify({ ...state.library, items: exportedItems }, null, 2) + '\n', 'application/json;charset=utf-8');
  });
  $('#export-markdown').addEventListener('click', () => {
    if (!state.library) return;
    const items = filteredItems();
    download('add-collection.md', `# ADD · 灵感收藏夹\n\n${items.length} 条收藏 · 最近更新 ${state.library.updatedAt}\n\n${items.length ? items.map(itemMarkdown).join('\n---\n\n') : '收藏夹已就位，等待第一条灵感。\n'}`, 'text/markdown;charset=utf-8');
  });
  $('#copy-intake').addEventListener('click', () => copy('请把下面的内容收进我的 ADD 灵感收藏夹（GitHub：LinZY874/add）：\n\n类型：提示词 / 风格图片 / 教程链接\n内容或链接：\n值得收藏的原因：\n想用于什么：\n标签（可选）：\n作者与出处（如有）：\n\n请保留来源，补充摘要和复用思路。信息不足时先标为待整理，再更新仓库与网站。', '收录格式已复制，粘贴到对话中就能开始'));
  $('#copy-api').addEventListener('click', () => copy(new URL('./api/library.json', document.baseURI).href, '已复制 JSON 内容接口链接'));

  function openHashItem() {
    if (!location.hash.startsWith('#item=')) return;
    try { openDetail(decodeURIComponent(location.hash.slice(6))); } catch { toast('这条收藏的链接格式不正确'); }
  }
  window.addEventListener('hashchange', () => { if (state.library) openHashItem(); });

  async function load() {
    $('#load-error').hidden = true;
    $('#collection').hidden = false;
    try {
      const response = await fetch(new URL('./data/library.json', document.baseURI), { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const library = await response.json();
      if (library.version !== 1 || !Array.isArray(library.items) || !/^\d{4}-\d{2}-\d{2}$/.test(library.updatedAt)) throw new Error('Invalid library');
      if (library.items.some(item => !names[item.type] || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.summary !== 'string' || !Array.isArray(item.tags) || typeof item.createdAt !== 'string')) throw new Error('Invalid item');
      state.library = library;
      renderCounts(); render(); openHashItem();
    } catch (error) {
      console.error('ADD collection could not load:', error);
      $('#collection').hidden = true;
      $('#load-error').hidden = false;
      $('#result-caption').textContent = '加载未完成';
    }
  }
  $('#retry-load').addEventListener('click', load);
  load();
})();
