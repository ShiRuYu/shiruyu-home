/* =========================================================
 * 博客内容模块 (blog 分支)
 * 3 篇文章 + Prism 代码高亮
 * ========================================================= */
(function () {
  'use strict';

  var PRISM_CSS = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
  var PRISM_CORE = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js';
  var PRISM_EXT = [
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-java.min.js',
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js',
    'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-json.min.js'
  ];

  var ARTICLES = [
    {
      title: 'shiyu-ai 教育平台架构：Java 21 + Spring Boot + langgraph4j',
      date: '2026-07-20',
      tags: ['Java', '架构', 'langgraph4j'],
      html: '<h1>shiyu-ai 教育平台架构</h1>' +
        '<div class="a-meta">2026-07-20 · Java 21 · Spring Boot 4.x</div>' +
        '<p>shiyu-ai 是一个教育平台，采用 <strong>Java 21 + Spring Boot + langgraph4j + LiteFlow</strong> 技术栈，' +
        '按三层模块组织：基础设施层、平台层、业务层。</p>' +
        '<h2>模块划分</h2>' +
        '<ul>' +
        '<li><strong>infrastructure</strong>（bootstrap / dal / web / common）：启动、数据访问、网关、公共能力</li>' +
        '<li><strong>platform</strong>（agent / auth / knowledge / memory / model / plugin / tool / usage / vector）：AI Agent 全链路能力</li>' +
        '<li><strong>business</strong>（education / record）：教育业务与学习记录</li>' +
        '</ul>' +
        '<h2>NodeFields 字段读取约定</h2>' +
        '<p>所有 <code>input.getParameter / output.addData</code> 的字符串 key 必须提取到 <code>NodeFields.FieldKey</code> 枚举，' +
        '禁止硬编码魔法字符串。字段读取按 <strong>input → config → default</strong> 三级优先：</p>' +
        '<pre><code class="language-java">// 注意: getParameter 传 null 才能走 config 分支\n' +
        'String v = input.getParameter(key);        // 1. 节点入参\n' +
        'if (v == null) v = config.get(key);        // 2. 配置\n' +
        'if (v == null) v = field.getDefaultValue(); // 3. 默认值</code></pre>' +
        '<h2>上下文跨线程传播</h2>' +
        '<p>登录上下文 <code>UserGlobalContext</code> 用 <code>InheritableThreadLocal</code> 而非普通 <code>ThreadLocal</code>，' +
        '配合 StateGraphBuilder 的 sync node 处理 ForkJoinPool（忽略 InheritableThreadLocal）与常规线程池两种执行环境。</p>'
    },
    {
      title: 'FongMi TV 蜘蛛 DEX 打包全流程踩坑',
      date: '2026-07-12',
      tags: ['FongMi', 'DEX', '逆向'],
      html: '<h1>FongMi TV 蜘蛛 DEX 打包</h1>' +
        '<div class="a-meta">2026-07-12 · CatVod · d8</div>' +
        '<p>FongMi/TV 支持 JSON 源与 JAR 聚合源。JAR 蜘蛛需要 <strong>DEX 格式</strong>（不是普通 JAR），且存在 QuickJS 与 CatVodOpen 两种运行时限制：</p>' +
        '<ul>' +
        '<li><strong>QuickJS</strong>：只支持自包含 JS（无 import），含 import 的脚本仅 CatVodOpen 可用</li>' +
        '<li><strong>JAR 蜘蛛</strong>：必须 DEX 格式，注意 <code>init(Context, String)</code> 双参陷阱</li>' +
        '<li><code>req()</code> 返回 <code>{content, code, headers}</code> 对象而非字符串，要取 <code>resp.content</code></li>' +
        '<li><code>tbname=movie</code> 才含视频条目</li>' +
        '</ul>' +
        '<h2>打包流程</h2>' +
        '<pre><code class="language-bash"># 1. 编译项目,取 target/classes\n' +
        'mvn compile\n' +
        '\n' +
        '# 2. 解压项目类到 dex-work(注意 -d 参数!)\n' +
        'unzip -o -q target/classes -d target/dex-work\n' +
        '\n' +
        '# 3. 把 18 个依赖 jar 也解压进来\n' +
        'for j in $(find ~/.m2/repository -name "*.jar" | grep -v sources); do\n' +
        '  unzip -o -q "$j" -d target/dex-work\n' +
        'done\n' +
        '\n' +
        '# 4. d8 打包(DEX)\n' +
        'd8 --min-api 26 --output target/ target/dex-work\n' +
        '\n' +
        '# 5. 验证蜘蛛数量\n' +
        'strings *.dex | grep "spider/" | wc -l</code></pre>' +
        '<p>产出约 <strong>3.9M 双 DEX、40 个蜘蛛</strong>。验证命令 <code>strings | grep \'spider/\'</code> 能确认蜘蛛类全部打入。</p>'
    },
    {
      title: 'Sa-Token 线程上下文：ThreadLocal 与跨线程传播',
      date: '2026-06-28',
      tags: ['Sa-Token', 'ThreadLocal', '并发'],
      html: '<h1>Sa-Token 线程上下文跨线程传播</h1>' +
        '<div class="a-meta">2026-06-28 · ThreadLocal · langgraph4j</div>' +
        '<p>Sa-Token 的登录上下文基于 <code>ThreadLocal</code> 存储，直接 new Thread 或线程池会丢失上下文。' +
        '排查时要能区分两种错误：<strong>静态字段初始化失败</strong> 与 <strong>ThreadLocal 线程丢失</strong>。</p>' +
        '<h2>方案：InheritableThreadLocal</h2>' +
        '<pre><code class="language-java">// 子线程自动继承父线程值\n' +
        'private static final ThreadLocal&lt;UserGlobalContext&gt; CTX =\n' +
        '    new InheritableThreadLocal&lt;&gt;();\n' +
        '\n' +
        'public static UserGlobalContext get() { return CTX.get(); }\n' +
        'public static void set(UserGlobalContext ctx) { CTX.set(ctx); }\n' +
        'public static void remove() { CTX.remove(); }</code></pre>' +
        '<h2>坑：ForkJoinPool 不继承</h2>' +
        '<p><code>InheritableThreadLocal</code> 只在 <strong>新建线程</strong> 时复制一次。' +
        'langgraph4j StateGraphBuilder 的 sync node 若跑在 <code>ForkJoinPool</code>（线程复用、不重新创建），继承机制失效，' +
        '需要显式在任务提交时传递上下文，或对 ForkJoinPool 工作线程做补偿处理。</p>' +
        '<blockquote>结论：同步节点要分别处理 ForkJoinPool（忽略 InheritableThreadLocal）与常规线程池两种执行路径。</blockquote>'
    }
  ];

  var viewEl = null;
  var listEl = null;
  var postEl = null;
  var articleEl = null;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderList() {
    listEl.innerHTML = ARTICLES.map(function (a, i) {
      return '<div class="post-card" data-i="' + i + '">' +
        '<h3>' + esc(a.title) + '</h3>' +
        '<p>' + esc(a.html.slice(0, 90).replace(/<[^>]+>/g, '')) + '…</p>' +
        '<div class="post-meta">' +
        a.tags.map(function (t) { return '<span class="post-tag">' + t + '</span>'; }).join('') +
        '<span class="post-date">' + a.date + '</span>' +
        '</div></div>';
    }).join('');
    listEl.querySelectorAll('.post-card').forEach(function (card) {
      card.onclick = function () { openPost(parseInt(card.dataset.i, 10)); };
    });
  }

  function openPost(i) {
    var a = ARTICLES[i];
    articleEl.innerHTML = a.html;
    listEl.hidden = true;
    postEl.hidden = false;
    highlight();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function highlight() {
    if (window.Prism) {
      Prism.highlightAllUnder(articleEl);
      return;
    }
    injectScript(PRISM_CORE, function () {
      var loaded = 0;
      PRISM_EXT.forEach(function (src) {
        injectScript(src, function () {
          loaded++;
          if (loaded === PRISM_EXT.length) Prism.highlightAllUnder(articleEl);
        });
      });
    });
  }

  function injectScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    document.head.appendChild(s);
  }

  window.ModuleLifecycle = {
    init: function (view) {
      viewEl = view;
      listEl = document.getElementById('blog-list');
      postEl = document.getElementById('blog-post');
      articleEl = document.getElementById('blog-article');
      document.getElementById('blog-back').onclick = function () {
        postEl.hidden = true;
        listEl.hidden = false;
      };
      // 注入 Prism 样式
      if (!document.getElementById('prism-css')) {
        var l = document.createElement('link');
        l.id = 'prism-css';
        l.rel = 'stylesheet';
        l.href = PRISM_CSS;
        document.head.appendChild(l);
      }
      renderList();
    },
    destroy: function () {
      if (viewEl) viewEl.innerHTML = '';
    }
  };
})();
