/* =========================================================
 * CG 画廊内容模块 (cg 分支)
 * 图源: nekos.best 公开 API (neko + waifu 混合)
 * ========================================================= */
(function () {
  'use strict';

  var API = 'https://nekos.best/api/v2/';
  var gridEl = null;
  var items = [];

  function fetchBatch(cat, n) {
    return fetch(API + cat + '?amount=' + n)
      .then(function (r) { return r.json(); })
      .then(function (d) { return d.results || []; });
  }

  function render(imgs) {
    items = imgs;
    gridEl.innerHTML = imgs.map(function (im, i) {
      var artist = im.artist_name ? '🎨 ' + im.artist_name : '';
      return '<div class="cg-item" data-i="' + i + '">' +
        '<img loading="lazy" src="' + im.url + '" alt="CG ' + i + '" ' +
        (artist ? 'data-artist="' + artist + '"' : '') + '></div>';
    }).join('');

    gridEl.querySelectorAll('.cg-item').forEach(function (el) {
      var img = el.querySelector('img');
      img.onload = function () { el.classList.add('show'); };
      if (img.complete && img.naturalWidth > 0) el.classList.add('show');
      el.onclick = function () { openLightbox(parseInt(el.dataset.i, 10)); };
    });
  }

  function openLightbox(i) {
    var im = items[i];
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
    lb.hidden = false;
  }

  function closeLightbox() {
    document.getElementById('cg-lightbox').hidden = true;
  }

  function loadAll(btn) {
    if (btn) btn.disabled = true;
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

  window.ModuleLifecycle = {
    init: function (view) {
      gridEl = document.getElementById('cg-grid');
      document.getElementById('cg-refresh').onclick = function () { loadAll(this); };
      document.getElementById('lb-close').onclick = closeLightbox;
      document.getElementById('cg-lightbox').addEventListener('click', function (e) {
        if (e.target.classList.contains('lb-backdrop')) closeLightbox();
      });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') closeLightbox();
      });
      loadAll(null);
    },
    destroy: function () {
      if (gridEl) gridEl.innerHTML = '';
      closeLightbox();
    }
  };
})();
