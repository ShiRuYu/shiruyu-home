/* =========================================================
 * shiruyu-home 外壳核心：内部内容切换
 * master 分支仅此一个 SPA 外壳 + 模块选择首页
 * 内容模块按分支存放（blog / cg / lottery），经 jsdelivr CDN 动态加载
 * 模块接口约定：script.js 暴露 window.ModuleLifecycle = { init, destroy }
 * ========================================================= */

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/ShiRuYu/shiruyu-home@';
const DAY = new Date().toISOString().slice(0, 10);
const MEM_KEY = 'shiruyu-module';
const view = document.getElementById('view');
const switcher = document.getElementById('switcher');
let registry = null;

/* ---------- 工具 ---------- */
async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.text();
}

/* ---------- 切换器渲染 ---------- */
function renderSwitcher(currentId) {
  switcher.innerHTML = '';
  registry.modules.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'switch-btn' + (m.id === currentId ? ' active' : '');
    btn.textContent = m.icon + ' ' + m.name;
    btn.onclick = () => loadModule(m.id);
    switcher.appendChild(btn);
  });
}

/* ---------- 模块选择首页（master 自带） ---------- */
function renderHome() {
  view.innerHTML = `
    <section class="home-hero">
      <h1>ShiRuYu</h1>
      <p>全栈开发者 · AI Agent 工程 · 动漫爱好者</p>
    </section>
    <section class="home-cards">
      ${registry.modules.map((m) => `
        <a class="home-card" data-id="${m.id}">
          <div class="icon">${m.icon}</div>
          <h3>${m.name}</h3>
          <p>${m.desc}</p>
        </a>`).join('')}
    </section>`;
  view.querySelectorAll('.home-card').forEach((card) => {
    card.onclick = () => loadModule(card.dataset.id);
  });
  renderSwitcher(null);
  localStorage.removeItem(MEM_KEY);
  history.replaceState(null, '', '#/');
}

/* ---------- 模块生命周期 ---------- */
function destroyModule() {
  if (window.ModuleLifecycle && typeof window.ModuleLifecycle.destroy === 'function') {
    try { window.ModuleLifecycle.destroy(); } catch (e) { console.warn('destroy err', e); }
  }
  window.ModuleLifecycle = null;
  const st = document.getElementById('module-style');
  if (st) st.remove();
}

/* ---------- 加载内容模块 ---------- */
async function loadModule(id) {
  const m = registry.modules.find((x) => x.id === id);
  if (!m) { renderHome(); return; }
  view.innerHTML = '<div class="loading">正在加载 ' + m.name + ' …</div>';
  renderSwitcher(id);
  destroyModule();
  try {
    const base = CDN_BASE + m.branch + '/';
    const html = await fetchText(base + 'content.html?v=' + DAY);
    const css = await fetchText(base + 'style.css?v=' + DAY);
    const js = await fetchText(base + 'script.js?v=' + DAY);

    view.innerHTML = html;

    const st = document.createElement('style');
    st.id = 'module-style';
    st.textContent = css;
    document.head.appendChild(st);

    // 模块脚本可能引用 window.ModuleLifecycle 自执行
    new Function(js)();
    if (window.ModuleLifecycle && typeof window.ModuleLifecycle.init === 'function') {
      window.ModuleLifecycle.init(view);
    }
    localStorage.setItem(MEM_KEY, id);
    history.replaceState(null, '', '#/' + id);
  } catch (e) {
    console.error(e);
    view.innerHTML = `
      <div class="loading" style="color:#f87171">
        模块加载失败：${e.message}<br><br>
        <button class="switch-btn" onclick="renderHome()">返回首页</button>
      </div>`;
  }
}

/* ---------- 启动 ---------- */
(async function boot() {
  registry = JSON.parse(await fetchText('registry.json?v=' + DAY));
  const saved = localStorage.getItem(MEM_KEY);
  const hashId = location.hash.replace(/^#\//, '');
  const target = hashId || saved;
  if (target && registry.modules.some((m) => m.id === target)) {
    loadModule(target);
  } else {
    renderHome();
  }
  window.addEventListener('hashchange', () => {
    const hid = location.hash.replace(/^#\//, '');
    if (!hid) { renderHome(); return; }
    const m = registry.modules.find((x) => x.id === hid);
    if (m) loadModule(m.id);
  });
})();
