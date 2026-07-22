(() => {
  'use strict';

  const iconPaths = {
    arrowLeft: '<polyline points="15 18 9 12 15 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
    panels: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.6 7l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.3a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    plug: '<path d="M12 22v-5M9 8V2M15 8V2M6 8h12v3a6 6 0 0 1-12 0V8z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    folder: '<path d="M3 6h6l2 2h10v11H3V6z"/>',
    edit: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.4-9.4z"/>',
    trash: '<path d="M3 6h18M19 6v14H5V6M8 6V3h8v3M10 10v6M14 10v6"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.4 9A7 7 0 0 0 6.2 5.8L4 8M5.6 15A7 7 0 0 0 17.8 18.2L20 16"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/>',
    command: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6z"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    alert: '<path d="M12 3 2 21h20L12 3zM12 9v5M12 18h.01"/>',
  };

  const icon = (name, label = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>${label ? `<span>${escapeHtml(label)}</span>` : ''}`;
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

  const seed = {
    skills: [
      { id: 'skill-1', name: 'claude-design', description: '生成高保真 HTML 设计原型、演示与视觉探索。', scope: 'project', filePath: '/DCode/.codex/skills/claude-design/SKILL.md', allowedTools: ['Read', 'Write', 'Browser'], enabled: true },
      { id: 'skill-2', name: 'check-fix', description: '分析修复影响、调用链与潜在回归风险。', scope: 'user', filePath: '~/.codex/skills/check-fix/SKILL.md', allowedTools: ['Read', 'Bash'], enabled: true },
      { id: 'skill-3', name: 'openai-docs', description: '检索 OpenAI 官方文档并提供可核验引用。', scope: 'builtin', filePath: '~/.codex/skills/.system/openai-docs/SKILL.md', allowedTools: ['WebSearch', 'WebFetch'], enabled: true },
      { id: 'skill-4', name: 'prompt-optimizer', description: '诊断、重写并验证复杂提示词与代理工作流。', scope: 'user', filePath: '~/.codex/skills/prompt-optimizer/SKILL.md', allowedTools: ['Read', 'Write'], enabled: false },
      { id: 'skill-5', name: 'skill-installer', description: '从精选目录或 GitHub 仓库安装 Codex 技能。', scope: 'builtin', filePath: '~/.codex/skills/.system/skill-installer/SKILL.md', allowedTools: ['Bash'], enabled: true },
    ],
    mcp: [
      { id: 'mcp-1', name: 'filesystem', scope: 'project', enabled: true, status: 'connected', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/DCode'], cwd: '/DCode', tools: ['read_file', 'list_directory', 'search_files'], lastError: '' },
      { id: 'mcp-2', name: 'browser', scope: 'user', enabled: true, status: 'connected', transport: 'http', url: 'http://127.0.0.1:8765/mcp', tools: ['open', 'snapshot', 'click', 'type', 'console'], lastError: '' },
      { id: 'mcp-3', name: 'postgres-dev', scope: 'project', enabled: true, status: 'error', transport: 'stdio', command: 'uvx', args: ['mcp-server-postgres'], cwd: '/DCode', tools: [], lastError: 'ECONNREFUSED 127.0.0.1:5432' },
      { id: 'mcp-4', name: 'design-assets', scope: 'user', enabled: false, status: 'stopped', transport: 'sse', url: 'https://assets.example.test/sse', tools: ['search_assets', 'download_asset'], lastError: '' },
      { id: 'mcp-5', name: 'project-index', scope: 'project', enabled: true, status: 'starting', transport: 'stdio', command: 'node', args: ['./scripts/index-mcp.js'], cwd: '/DCode', tools: [], lastError: '' },
    ],
  };

  const cloneSeed = () => JSON.parse(JSON.stringify(seed));
  const stored = safeParse(localStorage.getItem('dcode-settings-prototype'));
  const initialTweaks = { ...TWEAK_DEFAULTS, ...(stored?.tweaks || {}) };
  const state = {
    direction: initialTweaks.direction,
    theme: initialTweaks.theme,
    density: initialTweaks.density,
    section: stored?.section || 'skills',
    query: '',
    scope: 'all',
    expanded: new Set(),
    modal: null,
    data: stored?.data || cloneSeed(),
  };

  const scopeLabel = { builtin: '内置', user: '全局', project: '项目' };
  const statusLabel = { idle: 'idle', starting: 'starting', connected: 'connected', error: 'error', stopped: 'stopped' };
  const directionLabels = {
    native: ['原生实用', '低学习成本 · 延续当前 DCode 的 macOS 设置语言'],
    console: ['运维控制台', '诊断优先 · 把连接、错误和配置放在同一视线'],
    index: ['瑞士目录', '扫描与秩序 · 通过编号、规则线和明确层级组织信息'],
    workbench: ['模块工作台', '范围组织 · 将可调用能力作为可组合的工作模块'],
  };

  function safeParse(value) {
    try { return value ? JSON.parse(value) : null; } catch { return null; }
  }

  function persist() {
    localStorage.setItem('dcode-settings-prototype', JSON.stringify({
      tweaks: { direction: state.direction, theme: state.theme, density: state.density },
      section: state.section,
      data: state.data,
    }));
  }

  function setTweak(key, value) {
    state[key] = value;
    persist();
    window.parent?.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
  }

  function navMarkup() {
    const groups = [
      ['个人', [['panels', '外观'], ['gear', '配置'], ['mic', '语音输入'], ['globe', '网络搜索']]],
      ['集成', [['layers', '技能', 'skills'], ['plug', 'MCP 服务器', 'mcp']]],
      ['控制', [['shield', '权限控制']]],
    ];
    return `<aside class="app-nav">
      <div class="window-dots"><i></i><i></i><i></i></div>
      <button class="nav-back" data-action="back">${icon('arrowLeft', '返回应用')}</button>
      <label class="nav-search">${icon('search')}<input type="search" placeholder="搜索设置..." aria-label="搜索设置"></label>
      <div class="nav-groups">${groups.map(([label, items]) => `<section class="nav-group">
        <p class="nav-group-label">${label}</p>
        ${items.map(([iconName, itemLabel, section]) => `<button class="nav-item ${section === state.section ? 'is-active' : ''}" ${section ? `data-section="${section}"` : ''} title="${itemLabel}">${icon(iconName, itemLabel)}</button>`).join('')}
      </section>`).join('')}</div>
      <div class="nav-project">当前项目<strong>DCode</strong>/Users/conan/Code/06-Project/DCode</div>
    </aside>`;
  }

  function summaryMarkup(items) {
    if (state.section === 'skills') {
      return `<div class="summary-strip">
        <div class="summary-item"><strong>${items.length}</strong><span>当前结果</span></div>
        <div class="summary-item"><strong>${items.filter(x => x.enabled).length}</strong><span>已启用</span></div>
        <div class="summary-item"><strong>${state.data.skills.filter(x => x.scope === 'project').length}</strong><span>项目技能</span></div>
        <div class="summary-item"><strong>${new Set(items.flatMap(x => x.allowedTools || [])).size}</strong><span>工具权限</span></div>
      </div>`;
    }
    return `<div class="summary-strip">
      <div class="summary-item"><strong>${items.length}</strong><span>当前结果</span></div>
      <div class="summary-item"><strong>${state.data.mcp.filter(x => x.status === 'connected').length}</strong><span>已连接</span></div>
      <div class="summary-item"><strong>${state.data.mcp.reduce((sum, x) => sum + x.tools.length, 0)}</strong><span>可用工具</span></div>
      <div class="summary-item"><strong>${state.data.mcp.filter(x => x.status === 'error').length}</strong><span>异常</span></div>
    </div>`;
  }

  function filteredItems() {
    const collection = state.section === 'skills' ? state.data.skills : state.data.mcp;
    const query = state.query.trim().toLowerCase();
    return collection.filter(item => {
      const scopePass = state.scope === 'all' || item.scope === state.scope;
      const searchText = state.section === 'skills'
        ? [item.name, item.description, item.filePath, ...(item.allowedTools || [])].join(' ')
        : [item.name, item.status, item.transport, item.command, item.url, item.lastError, ...(item.tools || [])].join(' ');
      return scopePass && (!query || searchText.toLowerCase().includes(query));
    });
  }

  function skillRecord(item) {
    const expanded = state.expanded.has(item.id);
    return `<article class="record ${expanded ? 'is-expanded' : ''}" data-id="${item.id}" aria-disabled="${!item.enabled}">
      <div class="record-main">
        <button class="record-symbol" data-action="expand" title="${expanded ? '收起详情' : '展开详情'}" aria-expanded="${expanded}">${icon('layers')}</button>
        <div class="record-copy">
          <div class="record-title-line"><span class="record-title">${escapeHtml(item.name)}</span><span class="scope-badge">${scopeLabel[item.scope]}</span></div>
          <div class="record-meta"><span>${escapeHtml(item.description)}</span><span>${item.allowedTools.length} 个工具</span></div>
        </div>
        <div class="record-actions">
          ${item.scope !== 'builtin' ? `<button class="icon-button" data-action="edit" title="编辑技能" aria-label="编辑技能">${icon('edit')}</button><button class="icon-button danger" data-action="delete" title="删除技能" aria-label="删除技能">${icon('trash')}</button>` : ''}
        </div>
        <button class="toggle" role="switch" aria-checked="${item.enabled}" data-action="toggle" title="${item.enabled ? '停用技能' : '启用技能'}"></button>
      </div>
      <div class="record-detail">
        <div class="detail-block"><h3>允许调用</h3><div class="tag-row">${item.allowedTools.map(tool => `<span class="tag">${escapeHtml(tool)}</span>`).join('') || '<span class="tag">未限制</span>'}</div></div>
        <div class="detail-block"><h3>入口文件</h3><code>${escapeHtml(item.filePath)}</code></div>
      </div>
    </article>`;
  }

  function mcpRecord(item) {
    const expanded = state.expanded.has(item.id);
    const config = item.transport === 'stdio'
      ? `${item.command} ${(item.args || []).join(' ')}`.trim()
      : item.url;
    return `<article class="record ${expanded ? 'is-expanded' : ''}" data-id="${item.id}" aria-disabled="${!item.enabled}">
      <div class="record-main">
        <button class="record-symbol" data-action="expand" title="${expanded ? '收起详情' : '展开详情'}" aria-expanded="${expanded}">${icon('plug')}</button>
        <div class="record-copy">
          <div class="record-title-line"><span class="record-title">${escapeHtml(item.name)}</span><span class="status-badge status-${item.status}">${statusLabel[item.status]}</span><span class="scope-badge">${scopeLabel[item.scope]}</span></div>
          <div class="record-meta"><span>${escapeHtml(config)}</span><span>${item.tools.length} 个工具</span>${item.lastError ? `<span style="color:var(--danger)">${escapeHtml(item.lastError)}</span>` : ''}</div>
        </div>
        <div class="record-actions">
          <button class="icon-button" data-action="restart" title="重启服务器" aria-label="重启服务器">${icon('rotate')}</button>
          <button class="icon-button" data-action="edit" title="编辑服务器" aria-label="编辑服务器">${icon('edit')}</button>
          <button class="icon-button danger" data-action="delete" title="移除服务器" aria-label="移除服务器">${icon('trash')}</button>
        </div>
        <button class="toggle" role="switch" aria-checked="${item.enabled}" data-action="toggle" title="${item.enabled ? '停止服务器' : '启用服务器'}"></button>
      </div>
      <div class="record-detail">
        <div class="detail-block"><h3>连接配置 · ${escapeHtml(item.transport)}</h3><code>${escapeHtml(config)}</code>${item.cwd ? `<code>CWD ${escapeHtml(item.cwd)}</code>` : ''}${item.lastError ? `<p style="color:var(--danger);margin-top:8px">${escapeHtml(item.lastError)}</p>` : ''}</div>
        <div class="detail-block"><h3>暴露工具</h3><div class="tag-row">${item.tools.map(tool => `<span class="tag">mcp__${escapeHtml(item.name)}__${escapeHtml(tool)}</span>`).join('') || '<span class="tag">等待连接后发现</span>'}</div></div>
      </div>
    </article>`;
  }

  function emptyMarkup() {
    return `<div class="empty-state"><div><span class="empty-symbol">${icon(state.section === 'skills' ? 'layers' : 'plug')}</span><h2>没有匹配结果</h2><p>调整搜索词或作用域后再试。</p><button class="button" data-action="clear-filters">清除筛选</button></div></div>`;
  }

  function contentMarkup() {
    const items = filteredItems();
    const [directionTitle, directionDescription] = directionLabels[state.direction];
    const isSkills = state.section === 'skills';
    const title = isSkills ? '技能' : 'MCP 服务器';
    const description = isSkills ? '管理 Codex 可读取和调用的内置与自定义技能。' : '管理工具服务器、运行状态和向代理暴露的能力。';
    return `<main class="app-content">
      <div class="content-inner">
        <header class="page-header">
          <div><p class="page-eyebrow">${escapeHtml(directionTitle)} / ${isSkills ? 'Capabilities' : 'Connections'}</p><h1>${title}</h1><p class="page-description">${description} ${escapeHtml(directionDescription)}。</p></div>
          <div class="page-actions">
            ${isSkills ? `<button class="button" data-action="folder">${icon('folder', '管理文件')}</button>` : ''}
            <button class="button primary" data-action="add">${icon('plus', isSkills ? '新建技能' : '添加服务器')}</button>
          </div>
        </header>
        <div class="toolbar">
          <div class="view-tabs" role="tablist"><button class="view-tab ${isSkills ? 'is-active' : ''}" data-section="skills">技能</button><button class="view-tab ${!isSkills ? 'is-active' : ''}" data-section="mcp">MCP</button></div>
          <div class="toolbar-spacer"></div>
          <label class="content-search">${icon('search')}<input id="contentSearch" type="search" value="${escapeHtml(state.query)}" placeholder="搜索${title}..." aria-label="搜索${title}"></label>
          <select class="scope-filter" id="scopeFilter" aria-label="按作用域筛选">
            <option value="all" ${state.scope === 'all' ? 'selected' : ''}>全部作用域</option>
            <option value="builtin" ${state.scope === 'builtin' ? 'selected' : ''}>内置</option>
            <option value="user" ${state.scope === 'user' ? 'selected' : ''}>全局</option>
            <option value="project" ${state.scope === 'project' ? 'selected' : ''}>项目</option>
          </select>
        </div>
        ${summaryMarkup(items)}
        ${items.length ? `<section class="records" style="counter-reset:record">${items.map(isSkills ? skillRecord : mcpRecord).join('')}</section>` : emptyMarkup()}
      </div>
    </main>`;
  }

  function render() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.direction = state.direction;
    document.querySelectorAll('.direction-choice').forEach(button => {
      const active = button.dataset.direction === state.direction;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.getElementById('themeToggle').innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon');
    document.getElementById('resetPrototype').innerHTML = icon('refresh');
    document.getElementById('app').innerHTML = `<div class="app-shell">${navMarkup()}${contentMarkup()}</div>`;
    renderModal();
  }

  function modalFields() {
    const modal = state.modal;
    if (!modal) return '';
    const item = modal.item || {};
    if (modal.type === 'confirm') {
      return `<p class="danger-copy">确认${state.section === 'skills' ? '删除技能' : '移除服务器'} <strong>${escapeHtml(item.name)}</strong>？${state.section === 'mcp' ? ' 运行中的进程将停止，并从配置中移除。' : ' 对应的技能目录将不再出现在列表中。'}</p>`;
    }
    if (state.section === 'skills') {
      return `<div class="field-grid"><label class="field"><span>技能名称</span><input name="name" required value="${escapeHtml(item.name || '')}" placeholder="my-skill"></label><label class="field"><span>作用域</span><select name="scope"><option value="user" ${item.scope === 'user' ? 'selected' : ''}>全局</option><option value="project" ${item.scope !== 'user' ? 'selected' : ''}>项目</option></select></label></div>
        <label class="field"><span>描述</span><input name="description" required value="${escapeHtml(item.description || '')}" placeholder="这个技能解决什么问题"></label>
        <label class="field"><span>允许工具（逗号分隔）</span><input name="tools" value="${escapeHtml((item.allowedTools || []).join(', '))}" placeholder="Read, Write, Browser"></label>
        <label class="field"><span>技能指令</span><textarea name="body" placeholder="# 技能指令\n\n在这里描述工作流...">${item.id ? '# ' + escapeHtml(item.name) + '\n\n遵循项目规范完成任务。' : ''}</textarea></label>`;
    }
    return `<div class="field-grid"><label class="field"><span>服务器名称</span><input name="name" required value="${escapeHtml(item.name || '')}" placeholder="my-server"></label><label class="field"><span>作用域</span><select name="scope"><option value="user" ${item.scope === 'user' ? 'selected' : ''}>全局</option><option value="project" ${item.scope !== 'user' ? 'selected' : ''}>项目</option></select></label></div>
      <div class="field-grid"><label class="field"><span>传输方式</span><select name="transport"><option value="stdio" ${!item.transport || item.transport === 'stdio' ? 'selected' : ''}>stdio</option><option value="http" ${item.transport === 'http' ? 'selected' : ''}>http</option><option value="sse" ${item.transport === 'sse' ? 'selected' : ''}>sse</option></select></label><label class="field"><span>命令或 URL</span><input name="endpoint" required value="${escapeHtml(item.transport === 'stdio' ? item.command || '' : item.url || '')}" placeholder="npx 或 https://..."></label></div>
      <label class="field"><span>参数（每行一个）</span><textarea name="args" placeholder="-y\n@modelcontextprotocol/server-example">${escapeHtml((item.args || []).join('\n'))}</textarea></label>
      <label class="field"><span>工作目录</span><input name="cwd" value="${escapeHtml(item.cwd || '')}" placeholder="/path/to/project"></label>`;
  }

  function renderModal() {
    document.querySelector('.modal-backdrop')?.remove();
    if (!state.modal) return;
    const confirming = state.modal.type === 'confirm';
    const editing = state.modal.type === 'edit';
    const label = state.section === 'skills' ? '技能' : 'MCP 服务器';
    const title = confirming ? `${state.section === 'skills' ? '删除' : '移除'}${label}` : `${editing ? '编辑' : '新建'}${label}`;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" data-action="close-modal">
      <form class="modal" id="editorForm" data-action="modal-stop">
        <header class="modal-header"><h2>${title}</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('x')}</button></header>
        <div class="modal-body">${modalFields()}</div>
        <footer class="modal-footer"><button type="button" class="button" data-action="close-modal">取消</button><button type="submit" class="button primary" ${confirming ? 'style="background:var(--danger);border-color:var(--danger)"' : ''}>${confirming ? '确认' : '保存'}</button></footer>
      </form>
    </div>`);
  }

  function toast(message) {
    const region = document.getElementById('toastRegion');
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    region.appendChild(node);
    setTimeout(() => node.remove(), 2600);
  }

  function findItem(target) {
    const id = target.closest('.record')?.dataset.id;
    const collection = state.section === 'skills' ? state.data.skills : state.data.mcp;
    return collection.find(item => item.id === id);
  }

  function openModal(type, item = null) {
    state.modal = { type, item: item ? JSON.parse(JSON.stringify(item)) : null };
    renderModal();
  }

  function restartServer(item) {
    if (!item.enabled) item.enabled = true;
    item.status = 'starting';
    item.lastError = '';
    persist();
    render();
    toast(`${item.name} 正在重启`);
    setTimeout(() => {
      const current = state.data.mcp.find(server => server.id === item.id);
      if (!current || !current.enabled) return;
      current.status = 'connected';
      if (!current.tools.length) current.tools = ['search', 'inspect'];
      persist();
      render();
      toast(`${item.name} 已连接`);
    }, 1200);
  }

  document.addEventListener('click', (event) => {
    const directionButton = event.target.closest('.direction-choice');
    if (directionButton) {
      setTweak('direction', directionButton.dataset.direction);
      render();
      return;
    }
    if (event.target.closest('#themeToggle')) {
      setTweak('theme', state.theme === 'light' ? 'dark' : 'light');
      render();
      return;
    }
    if (event.target.closest('#resetPrototype')) {
      state.data = cloneSeed();
      state.query = '';
      state.scope = 'all';
      state.expanded.clear();
      persist();
      render();
      toast('模拟数据已重置');
      return;
    }
    const sectionButton = event.target.closest('[data-section]');
    if (sectionButton) {
      state.section = sectionButton.dataset.section;
      state.query = '';
      state.scope = 'all';
      state.expanded.clear();
      persist();
      render();
      return;
    }
    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;
    const item = findItem(actionTarget);
    if (action === 'modal-stop') return;
    if (action === 'close-modal') { state.modal = null; renderModal(); return; }
    if (action === 'back') { toast('原型中保留在设置页'); return; }
    if (action === 'folder') { toast('将打开 ~/.codex/skills'); return; }
    if (action === 'clear-filters') { state.query = ''; state.scope = 'all'; render(); return; }
    if (action === 'add') { openModal('add'); return; }
    if (!item) return;
    if (action === 'expand') {
      state.expanded.has(item.id) ? state.expanded.delete(item.id) : state.expanded.add(item.id);
      render();
    } else if (action === 'toggle') {
      item.enabled = !item.enabled;
      if (state.section === 'mcp') item.status = item.enabled ? 'starting' : 'stopped';
      persist();
      render();
      toast(`${item.name} 已${item.enabled ? '启用' : '停用'}`);
      if (state.section === 'mcp' && item.enabled) setTimeout(() => restartServer(item), 500);
    } else if (action === 'edit') {
      openModal('edit', item);
    } else if (action === 'delete') {
      openModal('confirm', item);
    } else if (action === 'restart') {
      restartServer(item);
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.id === 'contentSearch') {
      state.query = event.target.value;
      const cursor = event.target.selectionStart;
      render();
      const next = document.getElementById('contentSearch');
      next?.focus();
      if (typeof next?.setSelectionRange === 'function') next.setSelectionRange(cursor, cursor);
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'scopeFilter') {
      state.scope = event.target.value;
      render();
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'editorForm') return;
    event.preventDefault();
    const modal = state.modal;
    if (!modal) return;
    const collection = state.section === 'skills' ? state.data.skills : state.data.mcp;
    if (modal.type === 'confirm') {
      const index = collection.findIndex(item => item.id === modal.item.id);
      if (index >= 0) collection.splice(index, 1);
      toast(`${modal.item.name} 已移除`);
    } else {
      const form = new FormData(event.target);
      const name = String(form.get('name') || '').trim();
      if (!name) return;
      let next;
      if (state.section === 'skills') {
        next = {
          id: modal.item?.id || `skill-${Date.now()}`,
          name,
          scope: String(form.get('scope')),
          description: String(form.get('description') || '').trim(),
          filePath: modal.item?.filePath || `${form.get('scope') === 'project' ? '/DCode/.codex' : '~/.codex'}/skills/${name}/SKILL.md`,
          allowedTools: String(form.get('tools') || '').split(',').map(x => x.trim()).filter(Boolean),
          enabled: modal.item?.enabled ?? true,
        };
      } else {
        const transport = String(form.get('transport'));
        const endpoint = String(form.get('endpoint') || '').trim();
        next = {
          id: modal.item?.id || `mcp-${Date.now()}`,
          name,
          scope: String(form.get('scope')),
          enabled: modal.item?.enabled ?? true,
          status: modal.item?.status || 'starting',
          transport,
          command: transport === 'stdio' ? endpoint : undefined,
          url: transport === 'stdio' ? undefined : endpoint,
          args: String(form.get('args') || '').split('\n').map(x => x.trim()).filter(Boolean),
          cwd: String(form.get('cwd') || '').trim(),
          tools: modal.item?.tools || [],
          lastError: '',
        };
      }
      const index = collection.findIndex(item => item.id === next.id);
      index >= 0 ? collection.splice(index, 1, next) : collection.push(next);
      toast(`${next.name} 已保存`);
    }
    state.modal = null;
    persist();
    render();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.modal) { state.modal = null; renderModal(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('contentSearch')?.focus();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === ',') {
      event.preventDefault();
      setTweak('theme', state.theme === 'light' ? 'dark' : 'light');
      render();
    }
  });

  window.addEventListener('message', (event) => {
    if (event.data?.type === '__activate_edit_mode') document.querySelector('.direction-rail')?.classList.remove('is-hidden');
    if (event.data?.type === '__deactivate_edit_mode') document.querySelector('.direction-rail')?.classList.add('is-hidden');
  });
  window.parent?.postMessage({ type: '__edit_mode_available' }, '*');

  render();
})();
