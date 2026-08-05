/* =========================================================
 * 博客内容模块 (blog 分支) — md 文档版
 * 文章 = articles/YYYY-MM/*.md (front matter + markdown)
 * 索引 = articles/index.json (master 注入 window.__MODULE_REF__ 定位本分支 commit)
 * 渲染 = marked.js + Prism 高亮
 * ========================================================= */
(function () {
  'use strict';

  var REF = window.__MODULE_REF__ || 'blog';
  var CDN = 'https://cdn.jsdelivr.net/gh/ShiRuYu/shiruyu-home@' + REF + '/';
  var MARKED_JS = 'https://cdn.jsdelivr.net/npm/marked@11.2.0/marked.min.js';
  var PRISM_CSS = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
  var PRISM_CORE = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js';
  var PRISM_EXT = [
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-java.min.js',
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js',
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-json.min.js'
  ];

  var articles = [];
  var listEl, postEl, articleEl;

  function fetchText(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }

  function stripFrontMatter(md) {
    var m = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return m ? md.slice(m[0].length) : md;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function monthTitle(ym) {
    var p = ym.split('-');
    return p[0] + ' 年 ' + parseInt(p[1], 10) + ' 月';
  }

  function renderList() {
    var groups = {};
    articles.forEach(function (a) {
      var ym = a.date.slice(0, 7);
      (groups[ym] = groups[ym] || []).push(a);
    });
    var yms = Object.keys(groups).sort().reverse();
    listEl.innerHTML = yms.map(function (ym) {
      return '<div class="post-group"><h3 class="group-title">' + monthTitle(ym) + '</h3>' +
        groups[ym].map(function (a) {
          var catCls = 'tag-cat';
          return '<div class="post-card" data-path="' + esc(a.path) + '">' +
            '<h3>' + esc(a.title) + '</h3>' +
            '<div class="post-meta">' +
            '<span class="post-tag ' + catCls + '">' + esc(a.category || '杂谈') + '</span>' +
            (a.hot ? '<span class="post-tag hot-tag">🔥 ' + esc(a.hot) + '</span>' : '') +
            (a.tags && a.tags.length ? a.tags.slice(0, 3).map(function (t) {
              return '<span class="post-tag">' + esc(t) + '</span>';
            }).join('') : '') +
            '<span class="post-date">' + esc(a.date) + '</span>' +
            '</div></div>';
        }).join('') + '</div>';
    }).join('');

    listEl.querySelectorAll('.post-card').forEach(function (card) {
      card.onclick = function () { openPost(card.dataset.path); };
    });
  }

  function openPost(path) {
    listEl.hidden = true;
    postEl.hidden = false;
    articleEl.innerHTML = '<div class="loading" style="padding:40px 0">加载文章 …</div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchText(CDN + 'articles/' + path)
      .then(function (md) {
        var htmlText = stripFrontMatter(md);
        return ensureMarked().then(function () {
          articleEl.innerHTML = marked.parse(htmlText);
          highlight();
        });
      })
      .catch(function (e) {
        articleEl.innerHTML = '<div class="loading" style="color:#f87171;padding:40px 0">文章加载失败: ' + esc(e.message) + '</div>';
      });
  }

  function injectScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('加载 ' + src + ' 失败')); };
      document.head.appendChild(s);
    });
  }

  function injectCss(href, id) {
    if (document.getElementById(id)) return Promise.resolve();
    return new Promise(function (resolve) {
      var l = document.createElement('link');
      l.id = id;
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = resolve;
      document.head.appendChild(l);
    });
  }

  function ensureMarked() {
    if (window.marked) return Promise.resolve();
    return injectScript(MARKED_JS);
  }

  function highlight() {
    if (window.Prism) {
      Prism.highlightAllUnder(articleEl);
      return;
    }
    injectScript(PRISM_CORE).then(function () {
      return Promise.all(PRISM_EXT.map(injectScript));
    }).then(function () {
      Prism.highlightAllUnder(articleEl);
    }).catch(function (e) { console.warn(e); });
  }

  window.ModuleLifecycle = {
    init: function (view) {
      listEl = document.getElementById('blog-list');
      postEl = document.getElementById('blog-post');
      articleEl = document.getElementById('blog-article');
      document.getElementById('blog-back').onclick = function () {
        postEl.hidden = true;
        listEl.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      injectCss(PRISM_CSS, 'prism-css');
      listEl.innerHTML = '<div class="loading" style="padding:60px 0">加载文章列表 …</div>';
      fetchText(CDN + 'articles/index.json')
        .then(function (raw) {
          var idx = JSON.parse(raw);
          articles = (idx.articles || []).filter(function (a) { return a.path && a.title; });
          if (!articles.length) throw new Error('暂无文章');
          renderList();
        })
        .catch(function (e) {
          listEl.innerHTML = '<div class="loading" style="color:#f87171;padding:60px 0">' +
            '文章列表加载失败: ' + esc(e.message) + '</div>';
        });
    },
    destroy: function () {
      if (listEl) listEl.innerHTML = '';
    }
  };
})();
