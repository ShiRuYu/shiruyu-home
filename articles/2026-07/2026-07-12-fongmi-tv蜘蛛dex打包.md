---
title: "FongMi TV 蜘蛛 DEX 打包全流程踩坑"
date: 2026-07-12
category: 逆向
tags: [FongMi, DEX, 逆向]
---

# FongMi TV 蜘蛛 DEX 打包

> 2026-07-12 · CatVod · d8

FongMi/TV 支持 JSON 源与 JAR 聚合源。JAR 蜘蛛需要 **DEX 格式**（不是普通 JAR），且存在 QuickJS 与 CatVodOpen 两种运行时限制：

- **QuickJS**：只支持自包含 JS（无 import），含 import 的脚本仅 CatVodOpen 可用
- **JAR 蜘蛛**：必须 DEX 格式，注意 `init(Context, String)` 双参陷阱
- `req()` 返回 `{content, code, headers}` 对象而非字符串，要取 `resp.content`
- `tbname=movie` 才含视频条目

## 打包流程

```bash
# 1. 编译项目,取 target/classes
mvn compile

# 2. 解压项目类到 dex-work(注意 -d 参数!)
unzip -o -q target/classes -d target/dex-work

# 3. 把 18 个依赖 jar 也解压进来
for j in $(find ~/.m2/repository -name "*.jar" | grep -v sources); do
  unzip -o -q "$j" -d target/dex-work
done

# 4. d8 打包(DEX)
d8 --min-api 26 --output target/ target/dex-work

# 5. 验证蜘蛛数量
strings *.dex | grep "spider/" | wc -l
```

产出约 **3.9M 双 DEX、40 个蜘蛛**。验证命令 `strings | grep 'spider/'` 能确认蜘蛛类全部打入。
