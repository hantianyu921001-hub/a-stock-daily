/**
 * 生成 A股日报 网页展示
 * 读取 Obsidian vault 中的日报 .md 文件，生成一个带日期导航的 HTML 页面
 * 
 * 用法: node generate-daily-report-html.js
 * 输出: A股日报.html
 */

const fs = require('fs');
const path = require('path');

const VAULT_DIR = '/Users/annaguo/Documents/Obsidian Vault/投资参考';
const OUTPUT = path.join(__dirname, 'A股日报.html');

// 1. 读取所有日报文件
const files = fs.readdirSync(VAULT_DIR)
  .filter(f => f.startsWith('A股日报') && f.endsWith('.md'))
  .sort();

const reports = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(VAULT_DIR, f), 'utf-8');
  const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : '';
  const dayMap = ['周日','周一','周二','周三','周四','周五','周六'];
  const d = new Date(date + 'T00:00:00+08:00');
  const weekday = dayMap[d.getDay()];
  reports.push({ date, weekday, file: f, raw });
}

// 2. 嵌入为 JSON
const reportsJson = JSON.stringify(reports.map(r => ({ date: r.date, weekday: r.weekday, file: r.file, raw: r.raw })));

// 3. HTML 模板
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A股日报 — 市场复盘</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  :root {
    --bg: #f5f6f8;
    --sidebar-bg: #1a1f2e;
    --sidebar-text: #a0aec0;
    --sidebar-active: #ffffff;
    --card-bg: #ffffff;
    --text: #2d3748;
    --text-secondary: #718096;
    --border: #e2e8f0;
    --accent: #3182ce;
    --red: #e53e3e;
    --red-bg: #fff5f5;
    --green: #38a169;
    --green-bg: #f0fff4;
    --table-stripe: #f7fafc;
    --highlight-bg: #fffbeb;
    --highlight-border: #f6e05e;
    --tag-up-bg: #fed7d7;
    --tag-up-text: #c53030;
    --tag-down-bg: #c6f6d5;
    --tag-down-text: #276749;
  }

  * { margin:0; padding:0; box-sizing:border-box; }

  html { scroll-behavior: smooth; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    background: var(--bg);
    color: var(--text);
    display: flex;
    min-height: 100vh;
  }

  /* === Sidebar === */
  .sidebar {
    width: 260px;
    min-width: 260px;
    background: var(--sidebar-bg);
    color: var(--sidebar-text);
    display: flex;
    flex-direction: column;
    padding: 24px 0;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    overflow-y: auto;
    z-index: 10;
  }
  .sidebar-header {
    padding: 0 20px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    margin-bottom: 8px;
  }
  .sidebar-header h1 {
    font-size: 18px;
    color: #fff;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .sidebar-header .subtitle {
    font-size: 12px;
    color: #718096;
    margin-top: 4px;
  }
  .sidebar-nav { flex: 1; padding: 8px 0; }
  .sidebar-nav a {
    display: block;
    padding: 10px 20px;
    color: var(--sidebar-text);
    text-decoration: none;
    font-size: 14px;
    transition: all 0.15s;
    border-left: 3px solid transparent;
    cursor: pointer;
  }
  .sidebar-nav a:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
  .sidebar-nav a.active {
    color: var(--sidebar-active);
    background: rgba(255,255,255,0.08);
    border-left-color: var(--accent);
    font-weight: 600;
  }
  .sidebar-nav a .date-num { font-weight: 600; margin-right: 4px; }
  .sidebar-nav a .weekday { font-size: 12px; opacity: 0.7; margin-left: 4px; }
  .sidebar-nav a .badge-latest {
    display: inline-block;
    background: #e53e3e;
    color: #fff;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    margin-left: 6px;
    vertical-align: middle;
  }

  .sidebar-footer {
    padding: 16px 20px;
    border-top: 1px solid rgba(255,255,255,0.1);
    font-size: 11px;
    color: #4a5568;
  }

  /* === Main === */
  .main {
    margin-left: 260px;
    flex: 1;
    padding: 32px 40px;
    max-width: 1100px;
  }
  .report-date-header {
    margin-bottom: 24px;
  }
  .report-date-header h2 {
    font-size: 26px;
    font-weight: 700;
    color: #1a202c;
    margin-bottom: 4px;
  }
  .report-date-header .meta {
    font-size: 14px;
    color: var(--text-secondary);
  }
  .report-date-header .meta .tag {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    margin-left: 8px;
  }
  .tag-up { background: var(--tag-up-bg); color: var(--tag-up-text); }
  .tag-down { background: var(--tag-down-bg); color: var(--tag-down-text); }
  .tag-mixed { background: #fefcbf; color: #975a16; }

  /* === Content rendering === */
  .report-body { line-height: 1.8; }

  .report-body h1 { font-size: 20px; font-weight: 700; margin: 24px 0 12px; color: #1a202c; border-bottom: 2px solid var(--border); padding-bottom: 6px; }
  .report-body h2 { font-size: 18px; font-weight: 700; margin: 20px 0 10px; color: #2d3748; }
  .report-body h3 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; color: #4a5568; }

  .report-body p { margin: 8px 0; }
  .report-body ul, .report-body ol { margin: 8px 0; padding-left: 24px; }
  .report-body li { margin: 4px 0; }
  .report-body blockquote {
    margin: 12px 0;
    padding: 12px 16px;
    background: var(--highlight-bg);
    border-left: 4px solid var(--highlight-border);
    border-radius: 0 6px 6px 0;
    color: #744210;
    font-size: 14px;
  }
  .report-body blockquote p { margin: 0; }
  .report-body hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 20px 0;
  }
  .report-body strong { font-weight: 700; }
  .report-body em { font-style: italic; }

  /* === Tables === */
  .report-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 20px;
    font-size: 14px;
    background: var(--card-bg);
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .report-body thead { background: #edf2f7; }
  .report-body thead th {
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    color: #4a5568;
    font-size: 13px;
    white-space: nowrap;
  }
  .report-body tbody td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .report-body tbody tr:nth-child(even) { background: var(--table-stripe); }
  .report-body tbody tr:hover { background: #ebf8ff; }
  .report-body tbody td:first-child { font-weight: 500; }
  .report-body a { color: var(--accent); text-decoration: none; }
  .report-body a:hover { text-decoration: underline; }

  /* === Color highlights === */
  .up { color: var(--red); font-weight: 600; }
  .down { color: var(--green); font-weight: 600; }
  .flat { color: #a0aec0; }

  /* === One-liner highlight === */
  .oneliner {
    background: linear-gradient(135deg, #fffbeb 0%, #fef5e7 100%);
    border: 1px solid #f6e05e;
    border-radius: 8px;
    padding: 16px 20px;
    margin: 20px 0;
    font-size: 15px;
    font-weight: 500;
    color: #744210;
    line-height: 1.7;
  }
  .oneliner::before {
    content: "💡 一句话总结";
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: #975a16;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* === Code === */
  .report-body code {
    background: #edf2f7;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 13px;
  }

  /* === Loading / Empty === */
  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-secondary);
  }
  .empty-state .icon { font-size: 48px; margin-bottom: 16px; }

  /* === Section Tabs === */
  .section-tabs {
    display: flex;
    gap: 8px;
    padding: 12px 0;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .section-tabs::-webkit-scrollbar { display: none; }
  .section-tab {
    flex: 0 0 auto;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--card-bg);
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .section-tab:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .section-tab.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  /* === Responsive === */
  @media (max-width: 768px) {
    .sidebar { width: 100%; min-width: unset; position: relative; height: auto; }
    .main { margin-left: 0; padding: 20px; }
    body { flex-direction: column; }
  }
</style>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-header">
    <h1>📊 A股日报</h1>
    <div class="subtitle">市场复盘 &amp; 组合跟踪</div>
  </div>
  <nav class="sidebar-nav" id="nav"></nav>
  <div class="sidebar-footer">
    共 <span id="reportCount">0</span> 篇日报<br>
    数据来源：Obsidian Vault
  </div>
</div>

<div class="main" id="main"></div>

<script>
marked.setOptions({ breaks: true, gfm: true });

const REPORTS = ${reportsJson};

// ---- Colorize markdown: handle Chinese stock color convention ----
function colorizeMarkdown(md) {
  // Wrap standalone +X.XX% or +X% in red spans
  md = md.replace(/(\\*\\*\\+[\\d.]+%\\*\\*|\\+[\\d.]+%)/g, (m) => {
    if (m.includes('**')) return m.replace(/\\*\\*(.*)\\*\\*/, '<span class="up">$1</span>');
    return '<span class="up">' + m + '</span>';
  });
  // Wrap -X.XX% or -X% in green spans (but avoid dates like 2026-06-25)
  md = md.replace(/(?<!\\d)(\\*\\*-[\\d.]+%\\*\\*|-[\\d.]+%)(?!\\d)/g, (m) => {
    if (m.includes('**')) return m.replace(/\\*\\*(.*)\\*\\*/, '<span class="down">$1</span>');
    return '<span class="down">' + m + '</span>';
  });
  return md;
}

// ---- Handle Obsidian wiki links ----
function cleanWikilinks(md) {
  // [[A股日报 2026-06-22]] → A股日报 2026-06-22
  md = md.replace(/\\[\\[([^\\]]+)\\]\\]/g, '$1');
  return md;
}

// ---- Get overall market direction for date header badge ----
function getMarketMood(raw) {
  // Count up/down signals
  const upCount = (raw.match(/\\+[\\d.]+%/g) || []).length;
  const downCount = (raw.match(/-[\\d.]+%/g) || []).length;
  // Heuristic: check 上证指数涨跌幅
  const shMatch = raw.match(/上证指数[^|]*\\|\\s*[\\d.]+\\s*\\|\\s*\\*\\*([+-][\\d.]+)%/);
  let shPct = 0;
  if (shMatch) shPct = parseFloat(shMatch[1]);
  
  if (shPct > 0.5) return { cls: 'tag-up', text: '沪指收红' };
  if (shPct < -0.5) return { cls: 'tag-down', text: '沪指收绿' };
  return { cls: 'tag-mixed', text: '震荡' };
}

// ---- Render navigation ----
const nav = document.getElementById('nav');
const main = document.getElementById('main');
document.getElementById('reportCount').textContent = REPORTS.length;

REPORTS.forEach((r, i) => {
  const a = document.createElement('a');
  a.innerHTML = '<span class="date-num">' + r.date.slice(5) + '</span>' + r.weekday;
  if (i === REPORTS.length - 1) {
    a.innerHTML += '<span class="badge-latest">最新</span>';
  }
  a.onclick = () => renderReport(i, a);
  nav.appendChild(a);
});

// ---- Render a report ----
function renderReport(index, navEl) {
  // Update nav active
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  const r = REPORTS[index];
  const mood = getMarketMood(r.raw);

  let md = cleanWikilinks(r.raw);
  md = colorizeMarkdown(md);

  // Convert markdown to HTML
  let html = marked.parse(md);

  // Wrap "一句话总结" section
  html = html.replace(
    /<h2[^>]*>一句话总结<\\/h2>\\s*<p>(.*?)<\\/p>/s,
    '<div class="oneliner">$1</div>'
  );
  // Also handle "## 一句话总结" without <p> wrapper
  html = html.replace(
    /<h2[^>]*>一句话总结<\\/h2>\\s*(.*?)(?=<h[12]|<hr|$)/s,
    (m, p1) => {
      if (p1.trim().startsWith('<div class="oneliner"')) return m;
      return '<div class="oneliner">' + p1.trim() + '</div>';
    }
  );

  // ---- Add anchor IDs to headings and build section tabs ----
  const reportDate = r.date.replace(/-/g, '');
  let tabItems = [];
  let headingIndex = 0;
  html = html.replace(/<(h[23])([^>]*)>(.*?)<\\/\\1>/gi, (match, tag, attrs, text) => {
    const id = 'sec-' + reportDate + '-' + (headingIndex++);
    const level = tag.toLowerCase();
    if (level === 'h2') {
      tabItems.push({ id, text: text.replace(/<[^>]+>/g, '') });
    }
    return '<' + tag + attrs + ' id="' + id + '">' + text + '</' + tag + '>';
  });

  // Build section tabs HTML
  let tabsHtml = '';
  if (tabItems.length > 0) {
    tabsHtml = '<div class="section-tabs" id="sectionTabs">';
    tabItems.forEach((item, idx) => {
      tabsHtml += '<button class="section-tab' + (idx === 0 ? ' active' : '') + '" data-target="' + item.id + '">' + item.text + '</button>';
    });
    tabsHtml += '</div>';
  }

  main.innerHTML = 
    '<div class="report-date-header">' +
      '<h2>' + r.date + ' ' + r.weekday + '</h2>' +
      '<div class="meta">' +
        REPORTS.length + ' 篇日报中的第 ' + (index + 1) + ' 篇' +
        ' <span class="' + mood.cls + '">' + mood.text + '</span>' +
      '</div>' +
    '</div>' +
    tabsHtml +
    '<div class="report-body">' + html + '</div>';

  // Bind tab click events
  document.querySelectorAll('.section-tab').forEach(btn => {
    btn.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.section-tab').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });

  // Scroll spy: update active tab on scroll
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.querySelectorAll('.section-tab').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-target') === entry.target.id);
        });
      }
    });
  }, { rootMargin: '-10% 0px -70% 0px' });

  tabItems.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) sectionObserver.observe(el);
  });

  // Scroll to top
  window.scrollTo(0, 0);
}

// ---- Init: show latest report ----
if (REPORTS.length > 0) {
  const lastNav = nav.lastElementChild;
  renderReport(REPORTS.length - 1, lastNav);
} else {
  main.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>暂无日报数据</p></div>';
}
</script>
</body>
</html>`;

fs.writeFileSync(OUTPUT, html, 'utf-8');
console.log('✅ 已生成:', OUTPUT);
console.log('   包含', reports.length, '篇日报');
reports.forEach(r => console.log('   -', r.date, r.weekday));
