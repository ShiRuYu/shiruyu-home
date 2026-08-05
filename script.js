/* =========================================================
 * 抽签内容模块 (lottery 分支)
 * 加权概率签文 + 每日一签(localStorage) + 历史记录
 * ========================================================= */
(function () {
  'use strict';

  var KEY_TODAY = 'shiruyu-lottery-today';
  var KEY_HIST = 'shiruyu-lottery-hist';

  // 签文池: 大吉15% / 中吉25% / 小吉30% / 末吉20% / 凶10%
  var STICKS = [
    { l: '大吉', p: 15, t: '隐藏 SSR 抽中！欧皇附体，今天做啥都顺。' },
    { l: '大吉', p: 15, t: '紫气东来，今日宜 commit、宜发版、宜上分。' },
    { l: '大吉', p: 15, t: '天选之人！出门就能捡到满配显卡。' },
    { l: '大吉', p: 15, t: '诸事皆宜，百无禁忌，抽卡必出金。' },
    { l: '中吉', p: 25, t: '小有福气，午后咖啡记得加奶盖。' },
    { l: '中吉', p: 25, t: '宜摸鱼不宜熬夜，代码会自己跑通。' },
    { l: '中吉', p: 25, t: '旧 bug 会自己消失，新功能灵感爆棚。' },
    { l: '中吉', p: 25, t: '今天适合重看一遍自己的得意之作。' },
    { l: '中吉', p: 25, t: '福星高照，你的部署一次通过。' },
    { l: '中吉', p: 25, t: '柳暗花明，难题绕个弯就有答案。' },
    { l: '小吉', p: 30, t: '平平淡淡才是真，今天的饭很香。' },
    { l: '小吉', p: 30, t: '宜整理桌面，理完心情会变好。' },
    { l: '小吉', p: 30, t: '小确幸在路上，快递今天能到。' },
    { l: '小吉', p: 30, t: '适合补一篇技术笔记，说不定能火。' },
    { l: '小吉', p: 30, t: '网络顺畅，加载飞快，皆因今日吉祥。' },
    { l: '小吉', p: 30, t: '宜早睡，明日有惊喜。' },
    { l: '小吉', p: 30, t: '随手写的脚本今天特别听话。' },
    { l: '小吉', p: 30, t: '宜学新东西，记性今天出奇的好。' },
    { l: '末吉', p: 20, t: '再等等，好运正在编译中。' },
    { l: '末吉', p: 20, t: '今天的 bug 有点多，但总能修完。' },
    { l: '末吉', p: 20, t: '宜低调，不宜立 Flag。' },
    { l: '末吉', p: 20, t: '雨过会天晴，先冲杯咖啡再说。' },
    { l: '凶', p: 10, t: '今日忌裸奔上生产，忌删库跑路。' },
    { l: '凶', p: 10, t: '慎言慎行，别碰那个看起来没问题的配置。' }
  ];

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function pick() {
    var total = STICKS.reduce(function (s, x) { return s + x.p; }, 0);
    var r = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < STICKS.length; i++) {
      acc += STICKS[i].p;
      if (r < acc) return STICKS[i];
    }
    return STICKS[STICKS.length - 1];
  }

  function getToday() {
    try {
      var raw = localStorage.getItem(KEY_TODAY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return o.date === today() ? o : null;
    } catch (e) { return null; }
  }

  function saveToday(stick) {
    localStorage.setItem(KEY_TODAY, JSON.stringify({ date: today(), level: stick.l, text: stick.t }));
    var hist = [];
    try { hist = JSON.parse(localStorage.getItem(KEY_HIST)) || []; } catch (e) { hist = []; }
    hist.unshift({ date: today(), level: stick.l, text: stick.t });
    localStorage.setItem(KEY_HIST, JSON.stringify(hist.slice(0, 5)));
  }

  function renderHist() {
    var ul = document.getElementById('lt-hist');
    var hist = [];
    try { hist = JSON.parse(localStorage.getItem(KEY_HIST)) || []; } catch (e) { hist = []; }
    if (!hist.length) {
      ul.innerHTML = '<li class="empty">还没有抽过签，来一签试试？</li>';
      return;
    }
    ul.innerHTML = hist.map(function (h) {
      return '<li><span class="h-date">' + h.date + '</span>' +
        '<span class="h-level">' + h.level + '</span>' +
        '<span class="h-text">' + h.text + '</span></li>';
    }).join('');
  }

  function showResult(stick) {
    document.getElementById('lt-level').textContent = stick.l;
    document.getElementById('lt-text').textContent = stick.t;
    document.getElementById('lt-date').textContent = today();
    document.getElementById('lt-result').hidden = false;
  }

  function draw() {
    var btn = document.getElementById('lt-btn');
    var tube = document.getElementById('lt-tube');
    var existing = getToday();
    if (existing) {
      showResult(existing);
      btn.disabled = true;
      btn.textContent = '今日已抽';
      document.getElementById('lt-reset').hidden = false;
      return;
    }
    btn.disabled = true;
    tube.classList.add('shaking');
    setTimeout(function () {
      tube.classList.remove('shaking');
      var stick = pick();
      saveToday(stick);
      showResult(stick);
      renderHist();
      btn.textContent = '今日已抽';
      document.getElementById('lt-reset').hidden = false;
    }, 650);
  }

  function resetToday() {
    localStorage.removeItem(KEY_TODAY);
    document.getElementById('lt-result').hidden = true;
    var btn = document.getElementById('lt-btn');
    btn.disabled = false;
    btn.textContent = '抽 签';
    document.getElementById('lt-reset').hidden = true;
  }

  window.ModuleLifecycle = {
    init: function (view) {
      document.getElementById('lt-btn').onclick = draw;
      document.getElementById('lt-reset').onclick = resetToday;
      renderHist();
      var existing = getToday();
      if (existing) {
        showResult(existing);
        var btn = document.getElementById('lt-btn');
        btn.disabled = true;
        btn.textContent = '今日已抽';
        document.getElementById('lt-reset').hidden = false;
      }
    },
    destroy: function () {
      // 状态已持久化于 localStorage,无需额外清理
    }
  };
})();
