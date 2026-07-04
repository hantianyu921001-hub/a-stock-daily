# A股日报 - 静态网页展示

A股日报的网页展示版本，部署在 Cloudflare Pages。

## 本地预览

直接在浏览器中打开 `dist/index.html` 即可。

## 部署

### GitHub 推送

1. 在 GitHub 上创建新仓库（例如 `a-stock-daily`）
2. 运行以下命令推送代码：

```bash
cd /Users/annaguo/WorkBuddy/Claw
git remote add origin https://github.com/你的用户名/a-stock-daily.git
git branch -M main
git push -u origin main
```

### Cloudflare Pages 部署

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Pages** → **Create a project**
3. 连接 GitHub 仓库 `a-stock-daily`
4. 构建设置：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `dist`
5. 点击 **Save and Deploy**

部署完成后会得到一个 `*.pages.dev` 的永久链接。

## 更新流程

```bash
# 重新生成 HTML（运行你的生成脚本）
node generate-daily-report-html.js

# 复制到 dist 目录
cp "A股日报.html" dist/index.html

# 提交并推送
git add dist/index.html
git commit -m "更新日报"
git push
```

Cloudflare Pages 会自动重新部署。
