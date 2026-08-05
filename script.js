/* =========================================================
 * CG 画廊内容模块 (cg 分支)
 * 图源: nekos.best 公开 API (neko + waifu 混合)
 * 功能: 瀑布流 + 灯箱 + 喜欢收藏(localStorage) + 只看喜欢筛选
 * 性能: 元数据一次拉取, 图片分批渲染(滚动加载) + loading=lazy
 * 喜欢数据与 WebDAV 备份共享键名: shiruyu-cg-likes
 * ========================================================= */
(function () {
  'use strict';

  var API = 'https://nekos.best/api/v2/';
  var LIKES_KEY = 'shiruyu-cg-likes';
  var BATCH_SIZE = 6;        // 每批渲染 6 张
  var TOTAL = 30;            // 总张数

  var gridEl = null;
  var items = [];
  var likes = loadLikes();
  var filterLiked = false;
  var renderedCount = 0;
  var observer = null;
  var sentinel = null;

  function loadLikes() {
    try { return JSON.parse(localStorage.getItem(LIKES_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveLikes() {
    localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
    var c = document.getElementById('cg-like-count');
    if (c) c.textContent = likes.length;
  }

  function isLiked(url) { return likes.some(function (l) { return l.url === url; }); }

  function getLike(url) {
    for (var i = 0; i < likes.length; i++) if (likes[i].url === url) return likes[i];
    return null;
  }

  /* 返回 true=已喜欢, false=取消喜欢 */
  function toggleLike(im) {
    var i = likes.findIndex(function (l) { return l.url === im.url; });
    if (i >= 0) { likes.splice(i, 1); saveLikes(); return false; }
    likes.push({
      url: im.url,
      artist_name: im.artist_name || '',
      artist_href: im.artist_href || '',
      source_url: im.source_url || '',
      likedAt: new Date().toISOString()
    });
    saveLikes();
    return true;
  }

  function fetchBatch(cat, n) {
    return fetch(API + cat + '?amount=' + n)
      .then(function (r) { return r.json(); })
      .then(function (d) { return d.results || []; });
  }

  function cardHtml(im, i) {
    var liked = isLiked(im.url) ? ' liked' : '';
    var artist = im.artist_name ? '🎨 ' + im.artist_name : '';
    return '<div class="cg-item' + liked + '" data-i="' + i + '">' +
      '<img loading="lazy" src="' + im.url + '" alt="CG ' + i + '" ' +
      (artist ? 'data-artist="' + artist + '"' : '') + '>' +
      '<button class="cg-like" title="喜欢/取消">♥</button>' +
      '</div>';
  }

  function bindImages(scope) {
    (scope || gridEl).querySelectorAll('.cg-item img').forEach(function (img) {
      img.onload = function () {
        var el = img.closest('.cg-item');
        if (el) el.classList.add('show');
      };
      if (img.complete && img.naturalWidth > 0) {
        var el = img.closest('.cg-item');
        if (el) el.classList.add('show');
      }
    });
  }

  /* 渲染下一批图片到网格 */
  function renderNextBatch() {
    if (renderedCount >= items.length) return;
    var end = Math.min(renderedCount + BATCH_SIZE, items.length);
    var frag = items.slice(renderedCount, end).map(function (im, j) {
      return cardHtml(im, renderedCount + j);
    }).join('');
    gridEl.insertAdjacentHTML('beforeend', frag);
    bindImages();
    renderedCount = end;
    if (renderedCount >= items.length && sentinel) {
      sentinel.style.display = 'none';
      if (observer) { observer.disconnect(); observer = null; }
    }
  }

  function ensureObserver() {
    if (observer || filterLiked) return;
    sentinel = document.getElementById('cg-sentinel');
    if (!sentinel) return;
    observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) renderNextBatch();
    }, { rootMargin: '800px' });
    observer.observe(sentinel);
  }

  function render(imgs) {
    items = imgs;
    renderedCount = 0;
    gridEl.innerHTML = '';
    if (filterLiked) {
      // 只看喜欢: 直接用本地喜欢数据渲染(量小, 一次渲染)
      var data = likes.slice().reverse(); // 最新喜欢在前
      if (!data.length) {
        gridEl.innerHTML = '<div class="loading" style="padding:60px 0">还没有喜欢的图，去画廊点 ♥ 收藏吧</div>';
        return;
      }
      gridEl.innerHTML = data.map(function (im, i) {
        return cardHtml(im, i);
      }).join('');
      bindImages();
      return;
    }
    renderNextBatch();
    ensureObserver();
  }

  function openLightbox(i) {
    var im = filterLiked ? likes[likes.length - 1 - i] : items[i];
    if (!im) return;
    var lb = document.getElementById('cg-lightbox');
    document.getElementById('lb-img').src = im.url;
    var artistEl = document.getElementById('lb-artist');
    artistEl.textContent = im.artist_name ? '画师：' + im.artist_name : '画师：未知';
    var srcEl = document.getElementById('lb-source');
    if (im.source_url) {
      srcEl.href = im.source_url;
      srcEl.style.display = '';
    } else {
      srcEl.style.display = 'none';
    }
    var likeBtn = document.getElementById('lb-like');
    likeBtn.classList.toggle('liked', isLiked(im.url));
    likeBtn.dataset.url = im.url;
    lb.hidden = false;
  }

  function closeLightbox() {
    document.getElementById('cg-lightbox').hidden = true;
  }

  function loadAll(btn) {
    if (btn) btn.disabled = true;
    if (filterLiked) { // 只看喜欢模式下刷新 = 回到全部
      filterLiked = false;
      var f = document.getElementById('cg-like-filter');
      if (f) f.classList.remove('active');
    }
    if (observer) { observer.disconnect(); observer = null; }
    gridEl.innerHTML = '<div class="loading" style="padding:60px 0">正在拉取画师图集 …</div>';
    Promise.all([fetchBatch('neko', 18), fetchBatch('waifu', 12)])
      .then(function (arrs) {
        var imgs = arrs[0].concat(arrs[1]);
        if (!imgs.length) throw new Error('图源返回空');
        render(imgs);
        if (btn) btn.disabled = false;
      })
      .catch(function (e) {
        console.error(e);
        gridEl.innerHTML = '<div class="loading" style="color:#f87171;padding:60px 0">' +
          '图源加载失败：' + e.message + '（可能需要代理访问）</div>';
        if (btn) btn.disabled = false;
      });
  }

  function toggleFilter() {
    filterLiked = !filterLiked;
    var f = document.getElementById('cg-like-filter');
    f.classList.toggle('active', filterLiked);
    if (filterLiked) {
      render([]); // 只看喜欢
    } else {
      loadAll(null); // 回到全部并刷新
    }
  }

  window.ModuleLifecycle = {
    init: function (view) {
      gridEl = document.getElementById('cg-grid');
      document.getElementById('cg-refresh').onclick = function () { loadAll(this); };
      document.getElementById('cg-like-filter').onclick = toggleFilter;
      document.getElementById('lb-close').onclick = closeLightbox;
      document.getElementById('lb-like').onclick = function () {
        var url = this.dataset.url;
        var im = getLike(url);
        if (!im) {
          // 灯箱里喜欢的图可能不在当前批次(liked 模式下),先取当前显示对象
          im = { url: url, artist_name: document.getElementById('lb-artist').textContent.replace('画师：', ''), artist_href: '', source_url: document.getElementById('lb-source').href };
        }
        var nowLiked = toggleLike(im);
        this.classList.toggle('liked', nowLiked);
        // 同步网格卡片状态
        gridEl.querySelectorAll('.cg-item').forEach(function (el) {
          if (el.querySelector('img').src === url) {
            el.classList.toggle('liked', nowLiked);
            if (filterLiked && !nowLiked) el.remove();
          }
        });
        if (filterLiked) render([]); // 重绘喜欢列表
      };
      document.getElementById('cg-lightbox').addEventListener('click', function (e) {
        if (e.target.classList.contains('lb-backdrop')) closeLightbox();
      });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') closeLightbox();
      });
      // 网格点击事件委托(分批渲染也能命中)
      gridEl.addEventListener('click', function (e) {
        if (e.target.classList.contains('cg-like')) {
          var el = e.target.closest('.cg-item');
          var url = el.querySelector('img').src;
          var im = getLike(url);
          if (!im) {
            var idx = parseInt(el.dataset.i, 10);
            im = filterLiked ? null : items[idx];
          }
          if (!im) return;
          var nowLiked = toggleLike(im);
          el.classList.toggle('liked', nowLiked);
          if (filterLiked && !nowLiked) el.remove();
          return;
        }
        var card = e.target.closest('.cg-item');
        if (card) openLightbox(parseInt(card.dataset.i, 10));
      });
      saveLikes(); // 初始化计数
      loadAll(null);
    },
    destroy: function () {
      if (observer) { observer.disconnect(); observer = null; }
      if (gridEl) gridEl.innerHTML = '';
      closeLightbox();
    }
  };
})();
