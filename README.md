# shiruyu-home

ShiRuYu 的个人主页 —— 分支即内容，内部切换。

## 分支结构

| 分支 | 内容 |
|---|---|
| `master` | **纯外壳**：SPA 框架 + 模块选择首页（切换器核心） |
| `blog` | 内容模块：个人博客 |
| `cg` | 内容模块：CG 画廊（nekos.best API 图源） |
| `lottery` | 内容模块：抽签网站（每日一签） |

## 工作原理

- `master` 加载 `registry.json` 注册表，列出所有内容模块
- 点击切换 → 经 jsdelivr CDN 拉取目标分支的 `content.html` + `style.css` + `script.js`
- 注入内容区渲染，无刷新、无 iframe；选择记忆存 `localStorage`，URL hash 可直达（`#/cg`）

## 新增内容模块

1. 从 master 切出新分支：`git checkout -b <module> master`
2. 在新分支放三个文件：`content.html` / `style.css` / `script.js`
3. `script.js` 必须暴露模块生命周期：

```js
window.ModuleLifecycle = {
  init: function (view) { /* 挂载 */ },
  destroy: function () { /* 清理 */ }
};
```

4. 在 master 的 `registry.json` 注册模块信息
5. 推送分支即可，无需改外壳代码

## 模块接口约定

- 模块脚本通过 `new Function` 执行，命名空间自包含，勿污染全局
- 切换模块前会调用旧模块 `destroy()`
- 所有资源经 jsdelivr 加载，URL 带 `?v=日期` 破缓存
