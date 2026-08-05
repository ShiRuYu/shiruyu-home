/* =========================================================
 * shiruyu-home 外壳核心：内部内容切换 + WebDAV 数据备份
 * master 分支仅此一个 SPA 外壳 + 模块选择首页
 * 内容模块按分支存放（blog / cg / lottery），经 jsdelivr CDN 动态加载
 * 模块接口约定：script.js 暴露 window.ModuleLifecycle = { init, destroy }
 * ========================================================= */

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/ShiRuYu/shiruyu-home@';
const DAY = new Date().toISOString().slice(0, 10);
const MEM_KEY = 'shiruyu-module';
const WDAV_KEY = 'shiruyu-webdav';
const WDAV_LAST_KEY = 'shiruyu-webdav-last';

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

/* =========================================================
 * WebDAV 数据备份
 * 备份内容：抽签记录（每日签 + 历史）+ CG 喜欢列表
 * 纯前端直连 WebDAV，需要目标服务开启 CORS（PUT/PROPFIND/Authorization）
 * ========================================================= */
const WD_MODAL_ID = 'wd-modal';

function collectBackupData() {
  let cgLikes = [];
  let lotteryToday = null;
  let lotteryHist = [];
  try { cgLikes = JSON.parse(localStorage.getItem('shiruyu-cg-likes')) || []; } catch (e) {}
  try { lotteryToday = JSON.parse(localStorage.getItem('shiruyu-lottery-today')); } catch (e) {}
  try { lotteryHist = JSON.parse(localStorage.getItem('shiruyu-lottery-hist')) || []; } catch (e) {}
  return {
    app: 'shiruyu-home',
    version: 1,
    updatedAt: new Date().toISOString(),
    data: { cgLikes, lottery: { today: lotteryToday, hist: lotteryHist } }
  };
}

function restoreBackupData(payload) {
  if (!payload || !payload.data) throw new Error('备份文件格式无效');
  const d = payload.data;
  if (d.cgLikes) localStorage.setItem('shiruyu-cg-likes', JSON.stringify(d.cgLikes));
  if (d.lottery) {
    if (d.lottery.today) localStorage.setItem('shiruyu-lottery-today', JSON.stringify(d.lottery.today));
    if (d.lottery.hist) localStorage.setItem('shiruyu-lottery-hist', JSON.stringify(d.lottery.hist));
  }
}

function loadWdav() {
  try { return JSON.parse(localStorage.getItem(WDAV_KEY)) || {}; } catch (e) { return {}; }
}
function saveWdav(cfg) {
  localStorage.setItem(WDAV_KEY, JSON.stringify(cfg));
}

function wdAuth(user, pass) {
  return 'Basic ' + btoa(unescape(encodeURIComponent(user + ':' + pass)));
}

function wdBaseUrl(cfg) {
  let u = (cfg.url || '').trim();
  if (!u) throw new Error('请先填写 WebDAV URL');
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

async function wdPut(cfg, fileName, obj) {
  const res = await fetch(wdBaseUrl(cfg) + '/' + fileName, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': wdAuth(cfg.user || '', cfg.pass || '')
    },
    body: JSON.stringify(obj, null, 2)
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error('上传失败 HTTP ' + res.status);
  }
}

async function wdGet(cfg, fileName) {
  const res = await fetch(wdBaseUrl(cfg) + '/' + fileName, {
    method: 'GET',
    headers: { 'Authorization': wdAuth(cfg.user || '', cfg.pass || '') }
  });
  if (!res.ok) throw new Error('下载失败 HTTP ' + res.status);
  return res.json();
}

async function wdTest(cfg) {
  // PROPFIND 探测目录可达性
  const res = await fetch(wdBaseUrl(cfg) + '/', {
    method: 'PROPFIND',
    headers: {
      'Authorization': wdAuth(cfg.user || '', cfg.pass || ''),
      'Depth': '0'
    }
  });
  if (res.status === 401 || res.status === 403) throw new Error('认证失败，请检查用户名/密码（HTTP ' + res.status + '）');
  if (!res.ok) throw new Error('连接失败 HTTP ' + res.status);
  return res;
}

function readCfgFromForm() {
  return {
    url: document.getElementById('wd-url').value.trim(),
    user: document.getElementById('wd-user').value.trim(),
    pass: document.getElementById('wd-pass').value,
    file: document.getElementById('wd-file').value.trim() || 'shiruyu-home-backup.json',
    auto: document.getElementById('wd-auto').checked
  };
}

function wdMsg(text, cls) {
  const el = document.getElementById('wd-msg');
  el.textContent = text;
  el.className = 'wd-msg' + (cls ? ' ' + cls : '');
}

function wdBusy(on) {
  ['wd-test', 'wd-backup', 'wd-restore'].forEach((id) => {
    document.getElementById(id).disabled = on;
  });
}

function openWdModal() {
  let modal = document.getElementById(WD_MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = WD_MODAL_ID;
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-card">
        <button class="modal-close" id="wd-close">✕</button>
        <h3>⚙ 数据备份（WebDAV）</h3>
        <p class="modal-tip">备份内容：抽签记录（每日签 + 历史）+ CG 喜欢列表。配置保存在本浏览器，凭据不离开你的设备（直连 WebDAV）。</p>
        <label>WebDAV URL
          <input type="text" id="wd-url" placeholder="https://dav.example.com/dav/backup" autocomplete="off">
        </label>
        <label>用户名
          <input type="text" id="wd-user" autocomplete="username">
        </label>
        <label>密码
          <input type="password" id="wd-pass" autocomplete="current-password">
        </label>
        <label>备份文件名
          <input type="text" id="wd-file" value="shiruyu-home-backup.json" autocomplete="off">
        </label>
        <label class="wd-auto">
          <input type="checkbox" id="wd-auto"> 每日首次访问自动备份
        </label>
        <div class="wd-btns">
          <button id="wd-test">🔌 测试连接</button>
          <button id="wd-backup">📤 立即备份</button>
          <button id="wd-restore" class="warn">📥 从备份恢复</button>
        </div>
        <div class="wd-msg" id="wd-msg">就绪。若提示 CORS 错误，说明该 WebDAV 服务未开启跨域，可改用支持 CORS 的服务或联系站长加中转。</div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('.modal-backdrop').onclick = closeWdModal;
    document.getElementById('wd-close').onclick = closeWdModal;
    document.getElementById('wd-test').onclick = async () => {
      const cfg = readCfgFromForm();
      saveWdav(cfg);
      wdBusy(true);
      wdMsg('测试中 …');
      try {
        await wdTest(cfg);
        wdMsg('✅ 连接成功，目录可访问', 'ok');
      } catch (e) {
        wdMsg('❌ ' + e.message, 'err');
      }
      wdBusy(false);
    };
    document.getElementById('wd-backup').onclick = async () => {
      const cfg = readCfgFromForm();
      saveWdav(cfg);
      wdBusy(true);
      wdMsg('备份中 …');
      try {
        await wdPut(cfg, cfg.file, collectBackupData());
        localStorage.setItem(WDAV_LAST_KEY, DAY);
        wdMsg('✅ 备份完成 → ' + cfg.file + '（' + new Date().toLocaleString() + '）', 'ok');
      } catch (e) {
        wdMsg('❌ ' + e.message, 'err');
      }
      wdBusy(false);
    };
    document.getElementById('wd-restore').onclick = async () => {
      const cfg = readCfgFromForm();
      saveWdav(cfg);
      wdBusy(true);
      wdMsg('恢复中 …');
      try {
        const payload = await wdGet(cfg, cfg.file);
        restoreBackupData(payload);
        wdMsg('✅ 恢复成功，正在刷新页面生效 …', 'ok');
        setTimeout(() => location.reload(), 1200);
      } catch (e) {
        wdMsg('❌ ' + e.message, 'err');
      }
      wdBusy(false);
    };
  }
  // 填充已存配置
  const cfg = loadWdav();
  document.getElementById('wd-url').value = cfg.url || '';
  document.getElementById('wd-user').value = cfg.user || '';
  document.getElementById('wd-pass').value = cfg.pass || '';
  document.getElementById('wd-file').value = cfg.file || 'shiruyu-home-backup.json';
  document.getElementById('wd-auto').checked = !!cfg.auto;
  modal.hidden = false;
}

function closeWdModal() {
  const modal = document.getElementById(WD_MODAL_ID);
  if (modal) modal.hidden = true;
}

async function autoBackupIfDue() {
  try {
    const cfg = loadWdav();
    if (!cfg.auto || !cfg.url || !cfg.user) return;
    if (localStorage.getItem(WDAV_LAST_KEY) === DAY) return;
    await wdPut(cfg, cfg.file || 'shiruyu-home-backup.json', collectBackupData());
    localStorage.setItem(WDAV_LAST_KEY, DAY);
    console.log('[webdav] 自动备份完成', new Date().toLocaleString());
  } catch (e) {
    console.warn('[webdav] 自动备份失败（不阻塞使用）:', e.message);
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
  document.getElementById('settings-btn').onclick = openWdModal;
  window.addEventListener('hashchange', () => {
    const hid = location.hash.replace(/^#\//, '');
    if (!hid) { renderHome(); return; }
    const m = registry.modules.find((x) => x.id === hid);
    if (m) loadModule(m.id);
  });
  autoBackupIfDue(); // 可选自动备份,失败不阻塞
})();
