/**
 * 解析 sustained.markmap.md → 结构化 JSON，生成交互式脑图浏览网站
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.join(process.env.HOME, 'mindmaps/lujiazui-briefing/sustained.markmap.md');
const OUTPUT = path.join(__dirname, '脑图浏览.html');

// ----- 解析器 -----
function parse(lines) {
  const themes = [];
  let theme = null;
  let topic = null;
  const monthMap = {};

  for (const raw of lines) {
    // skip title line
    if (raw.startsWith('# ') && !raw.startsWith('## ')) continue;

    if (raw.startsWith('## ')) {
      theme = {
        title: raw.slice(3).trim(),
        topics: [],
      };
      themes.push(theme);
      topic = null;
      continue;
    }

    if (!theme) continue;

    // Second level: `- Title`
    if (/^- [^ ]/.test(raw)) {
      topic = {
        title: raw.slice(2).trim(),
        entries: [],
      };
      theme.topics.push(topic);
      extractDates(raw.slice(2).trim(), topic, theme.title);
      continue;
    }

    // Third level: `  - Content`
    if (/^  - /.test(raw)) {
      if (topic) {
        topic.entries.push(raw.slice(4).trim());
        extractDates(raw.slice(4).trim(), topic, theme.title);
      }
      continue;
    }

    // Fourth level: `    - Content`
    if (/^    - /.test(raw)) {
      if (topic) {
        topic.entries.push(raw.slice(6).trim());
        extractDates(raw.slice(6).trim(), topic, theme.title);
      }
    }
  }

  // Build timeline index
  const timeline = buildTimeline(themes);

  // Collect all unique dates
  const allDates = collectAllDates(themes);

  return { themes, timeline, allDates, meta: { totalThemes: themes.length, totalEntries: countEntries(themes) } };
}

// Extract date patterns: 6/24, 7/1, 6/22-28, 7/4-9, 2026Q1, etc.
const DATE_RE = /(\d{1,2})\/(\d{1,2})(?:[~\-—](\d{1,2}))?/g;
const YEAR_DATE_RE = /(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?/g;

function extractDates(text, topic, themeTitle) {
  if (!topic._dates) topic._dates = [];

  // Match M/D pattern
  let m;
  DATE_RE.lastIndex = 0;
  while ((m = DATE_RE.exec(text)) !== null) {
    const month = parseInt(m[1]);
    const day = parseInt(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      // Default year: assume 2026 for months 1-7, 2025 for later months if ambiguous
      const year = month <= 7 ? 2026 : 2025;
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!topic._dates.includes(dateKey)) {
        topic._dates.push(dateKey);
      }
    }
  }

  // Match YYYY/M/D pattern
  YEAR_DATE_RE.lastIndex = 0;
  while ((m = YEAR_DATE_RE.exec(text)) !== null) {
    const dateKey = `${m[1]}-${String(parseInt(m[2])).padStart(2, '0')}-${String(parseInt(m[3] || 1)).padStart(2, '0')}`;
    if (!topic._dates.includes(dateKey)) {
      topic._dates.push(dateKey);
    }
  }

  // Named months without day
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  for (let i = 0; i < monthNames.length; i++) {
    if (text.includes(monthNames[i])) {
      const dateKey = `2026-${String(i + 1).padStart(2, '0')}-01`;
      if (!topic._dates.includes(dateKey)) {
        topic._dates.push(dateKey);
      }
      break; // only first match
    }
  }
}

function buildTimeline(themes) {
  const map = {};
  for (const theme of themes) {
    for (const topic of theme.topics) {
      const dates = topic._dates || [];
      for (const d of dates) {
        if (!map[d]) map[d] = { date: d, items: [] };
        map[d].items.push({
          theme: theme.title,
          topic: topic.title,
          entries: topic.entries.slice(0, 3), // show first 3 entries
          count: topic.entries.length,
        });
      }
    }
  }
  return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
}

function collectAllDates(themes) {
  const set = new Set();
  for (const theme of themes) {
    for (const topic of theme.topics) {
      for (const d of (topic._dates || [])) {
        set.add(d);
      }
    }
  }
  return [...set].sort();
}

function countEntries(themes) {
  let n = 0;
  for (const theme of themes) {
    for (const topic of theme.topics) {
      n += topic.entries.length;
    }
  }
  return n;
}

// ----- 主流程 -----
const src = fs.readFileSync(INPUT, 'utf-8');
const lines = src.split('\n');
const data = parse(lines);

// Clean _dates from output (internal only)
for (const theme of data.themes) {
  for (const topic of theme.topics) {
    delete topic._dates;
  }
}

// Embed JSON into HTML template
const jsonStr = JSON.stringify(data).replace(/</g, '\\u003c');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>陆家嘴财经早餐 · 持续主题脑图</title>
<style>
:root {
  --bg: #f5f6f8;
  --sidebar-bg: #1a1d23;
  --sidebar-text: #a0a4b0;
  --sidebar-active: #fff;
  --card-bg: #fff;
  --text: #2c3e50;
  --text-secondary: #7f8c8d;
  --accent: #e63946;
  --accent-light: #fce4e4;
  --blue: #2b6cb0;
  --blue-light: #ebf4ff;
  --green: #27ae60;
  --green-light: #e8f8ef;
  --orange: #e67e22;
  --orange-light: #fef5e7;
  --purple: #8e44ad;
  --border: #e8ecf1;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.08);
  --radius: 8px;
  --radius-sm: 4px;
  --transition: 0.2s ease;
  --font-mono: 'SF Mono', 'Menlo', 'Monaco', monospace;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background:var(--bg); color:var(--text); display:flex; height:100vh; overflow:hidden; }
/* Sidebar */
.sidebar { width:240px; min-width:240px; background:var(--sidebar-bg); display:flex; flex-direction:column; overflow:hidden; }
.sidebar-header { padding:20px 18px 16px; border-bottom:1px solid rgba(255,255,255,0.08); }
.sidebar-header h2 { color:#fff; font-size:15px; font-weight:600; }
.sidebar-header p { color:var(--sidebar-text); font-size:11px; margin-top:4px; }
.sidebar-nav { flex:1; overflow-y:auto; padding:8px 0; }
.sidebar-nav::-webkit-scrollbar { width:4px; }
.sidebar-nav::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
.nav-item { display:flex; align-items:center; gap:10px; padding:10px 18px; cursor:pointer; color:var(--sidebar-text); font-size:13px; transition:var(--transition); border-left:3px solid transparent; position:relative; }
.nav-item:hover { color:#d0d4e0; background:rgba(255,255,255,0.04); }
.nav-item.active { color:var(--sidebar-active); background:rgba(255,255,255,0.08); border-left-color:var(--accent); font-weight:500; }
.nav-item .icon { width:28px; height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.nav-item .badge { margin-left:auto; background:rgba(255,255,255,0.12); color:#ccc; font-size:10px; padding:2px 7px; border-radius:10px; }
.nav-item.active .badge { background:var(--accent); color:#fff; }
/* Main */
.main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
/* Top bar */
.topbar { display:flex; align-items:center; gap:12px; padding:12px 20px; background:var(--card-bg); border-bottom:1px solid var(--border); flex-shrink:0; }
.topbar-title { font-size:16px; font-weight:600; }
.topbar-stats { margin-left:auto; font-size:12px; color:var(--text-secondary); }
.view-toggle { display:flex; border-radius:var(--radius-sm); overflow:hidden; border:1px solid var(--border); }
.view-btn { padding:6px 14px; font-size:12px; cursor:pointer; background:#fff; border:none; color:var(--text-secondary); transition:var(--transition); }
.view-btn.active { background:var(--blue); color:#fff; }
.timeline-filter { display:flex; gap:4px; flex-wrap:wrap; align-items:center; }
.date-chip { padding:3px 10px; font-size:11px; border-radius:12px; cursor:pointer; border:1px solid var(--border); background:#fff; color:var(--text-secondary); transition:var(--transition); white-space:nowrap; }
.date-chip:hover { border-color:var(--blue); color:var(--blue); }
.date-chip.active { background:var(--blue); color:#fff; border-color:var(--blue); }
/* Content area */
.content { flex:1; overflow-y:auto; padding:20px; }
.content::-webkit-scrollbar { width:6px; }
.content::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px; }
/* Theme cards */
.theme-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(380px, 1fr)); gap:16px; }
.theme-card { background:var(--card-bg); border-radius:var(--radius); box-shadow:var(--shadow); overflow:hidden; }
.theme-card-header { padding:14px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
.theme-card-header:hover { background:#fafbfc; }
.theme-card-header .icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.theme-card-title { font-size:14px; font-weight:600; }
.theme-card-count { font-size:11px; color:var(--text-secondary); margin-left:auto; }
.theme-card-arrow { font-size:12px; color:var(--text-secondary); transition:var(--transition); }
.theme-card-body { max-height:0; overflow:hidden; transition:max-height 0.35s ease; }
.theme-card.expanded .theme-card-body { max-height:2000px; }
.theme-card.expanded .theme-card-arrow { transform:rotate(180deg); }
/* Topic items */
.topic-group { border-bottom:1px solid #f0f2f5; }
.topic-group:last-child { border-bottom:none; }
.topic-header { padding:10px 16px 8px 28px; font-size:13px; font-weight:600; color:var(--blue); cursor:pointer; display:flex; align-items:center; gap:6px; }
.topic-header:hover { color:var(--accent); }
.topic-header .arrow { font-size:10px; transition:var(--transition); }
.topic-group.expanded .topic-header .arrow { transform:rotate(90deg); }
.topic-entries { max-height:0; overflow:hidden; transition:max-height 0.3s ease; }
.topic-group.expanded .topic-entries { max-height:800px; }
.entry-item { padding:5px 16px 5px 44px; font-size:12px; color:var(--text-secondary); line-height:1.6; position:relative; }
.entry-item::before { content:''; position:absolute; left:32px; top:13px; width:5px; height:5px; border-radius:50%; background:#d0d5dd; }
.entry-item:last-child { padding-bottom:12px; }
/* Timeline view */
.timeline-list { max-width:800px; margin:0 auto; }
.timeline-date-group { margin-bottom:20px; }
.timeline-date-label { font-size:14px; font-weight:700; color:var(--text); padding:8px 12px; background:var(--card-bg); border-radius:var(--radius) var(--radius) 0 0; border-bottom:2px solid var(--accent); display:flex; align-items:center; gap:8px; }
.timeline-date-label .weekday { font-size:11px; color:var(--text-secondary); font-weight:400; }
.timeline-cards { display:grid; gap:8px; }
.timeline-card { background:var(--card-bg); border-radius:0 0 var(--radius) var(--radius); box-shadow:var(--shadow); overflow:hidden; }
.timeline-card-header { padding:10px 14px; display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; border-bottom:1px solid var(--border); }
.timeline-card-header:hover { background:#fafbfc; }
.timeline-card-theme { font-size:10px; padding:2px 8px; border-radius:10px; font-weight:500; flex-shrink:0; }
.timeline-card-topic { font-weight:600; }
.timeline-card-count { font-size:11px; color:var(--text-secondary); margin-left:auto; }
.timeline-card-body { padding:8px 14px 12px; }
.timeline-entry { font-size:12px; color:var(--text-secondary); padding:3px 0; line-height:1.5; }
.timeline-entry::before { content:'· '; color:var(--accent); }
/* Search */
.search-box { padding:6px 12px; border:1px solid var(--border); border-radius:16px; font-size:12px; width:200px; outline:none; transition:var(--transition); background:#f8f9fa; }
.search-box:focus { border-color:var(--blue); background:#fff; width:260px; }
.no-results { text-align:center; padding:60px 20px; color:var(--text-secondary); }
.no-results .icon { font-size:40px; margin-bottom:12px; }
/* Theme colors for badges */
.tag-geopolitics { background:#fce4e4; color:#c0392b; }
.tag-tech { background:#ebf4ff; color:#2b6cb0; }
.tag-china { background:#e8f8ef; color:#27ae60; }
.tag-overseas { background:#fef5e7; color:#e67e22; }
.tag-fixed { background:#f3e8ff; color:#8e44ad; }
.tag-commodity { background:#fef3c7; color:#b45309; }
.tag-forex { background:#fce7f3; color:#be185d; }
.tag-policy { background:#e0e7ff; color:#4338ca; }
.tag-outlook { background:#f1f5f9; color:#475569; }
.tag-other { background:#f1f5f9; color:#64748b; }

@media (max-width: 900px) {
  .sidebar { width:60px; min-width:60px; }
  .sidebar-header { display:none; }
  .nav-item { padding:12px 0; justify-content:center; }
  .nav-item span:not(.icon) { display:none; }
  .theme-grid { grid-template-columns:1fr; }
}
</style>
</head>
<body>
<div class="sidebar">
  <div class="sidebar-header">
    <h2>📊 陆家嘴财经早餐</h2>
    <p>持续主题 · 交互脑图</p>
  </div>
  <div class="sidebar-nav" id="nav"></div>
</div>
<div class="main">
  <div class="topbar">
    <span class="topbar-title" id="mainTitle">全部主题</span>
    <div class="view-toggle">
      <button class="view-btn active" data-view="theme" onclick="switchView('theme')">📂 主题</button>
      <button class="view-btn" data-view="timeline" onclick="switchView('timeline')">📅 时间线</button>
    </div>
    <input class="search-box" id="searchInput" placeholder="🔍 搜索关键词..." oninput="onSearch()">
    <span class="topbar-stats" id="stats"></span>
  </div>
  <div class="content" id="content"></div>
</div>

<script>
const DATA = ${jsonStr};
const THEME_COLORS = {
  '全球地缘政治': 'geopolitics',
  '科技产业动态': 'tech',
  '中国市场': 'china',
  '海外市场': 'overseas',
  '固定收益': 'fixed',
  '大宗商品': 'commodity',
  '外汇市场': 'forex',
  '政策与监管': 'policy',
  '市场前瞻': 'outlook',
  '其他数据': 'other',
};
const THEME_ICONS = {
  '全球地缘政治': '🌍',
  '科技产业动态': '💻',
  '中国市场': '🇨🇳',
  '海外市场': '🌐',
  '固定收益': '📊',
  '大宗商品': '🛢️',
  '外汇市场': '💱',
  '政策与监管': '📜',
  '市场前瞻': '🔮',
  '其他数据': '📌',
};

let currentTheme = null;
let currentView = 'theme';
let searchQuery = '';

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  render();
}

function onSearch() {
  searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
  render();
}

function getWeekday(dateStr) {
  const d = new Date(dateStr);
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
}

// Build nav
function buildNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';
  // "All" button
  const all = document.createElement('div');
  all.className = 'nav-item' + (currentTheme === null ? ' active' : '');
  all.innerHTML = '<span class="icon">📋</span><span>全部主题</span><span class="badge">' + DATA.meta.totalThemes + '</span>';
  all.onclick = () => { currentTheme = null; render(); };
  nav.appendChild(all);

  DATA.themes.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'nav-item' + (currentTheme === i ? ' active' : '');
    item.innerHTML = '<span class="icon">' + (THEME_ICONS[t.title] || '📄') + '</span><span>' + t.title + '</span><span class="badge">' + t.topics.length + '</span>';
    item.onclick = () => { currentTheme = i; render(); };
    nav.appendChild(item);
  });
}

function getTagClass(themeTitle) {
  return THEME_COLORS[themeTitle] || 'other';
}

function render() {
  buildNav();
  document.getElementById('stats').textContent = DATA.meta.totalThemes + ' 主题 · ' + DATA.meta.totalEntries + ' 条目';

  const title = currentTheme !== null ? DATA.themes[currentTheme].title : '全部主题';
  document.getElementById('mainTitle').textContent = title;

  let filteredThemes = DATA.themes;
  if (currentTheme !== null) {
    filteredThemes = [DATA.themes[currentTheme]];
  }

  // Apply search filter
  if (searchQuery) {
    filteredThemes = filteredThemes.map(t => ({
      ...t,
      topics: t.topics.filter(tp => {
        const allText = tp.title + ' ' + tp.entries.join(' ');
        return allText.toLowerCase().includes(searchQuery);
      }),
    })).filter(t => t.topics.length > 0);
  }

  const content = document.getElementById('content');

  if (currentView === 'timeline') {
    renderTimeline(content, filteredThemes);
  } else {
    renderTheme(content, filteredThemes);
  }
}

function renderTheme(content, themes) {
  if (themes.length === 0) {
    content.innerHTML = '<div class="no-results"><div class="icon">🔍</div><p>没有匹配的结果</p></div>';
    return;
  }

  const cards = themes.map(t => {
    const icon = THEME_ICONS[t.title] || '📄';
    const topicsHtml = t.topics.map(tp => {
      const entriesHtml = tp.entries.map(e => '<div class="entry-item">' + escHtml(e) + '</div>').join('');
      return '<div class="topic-group expanded" onclick="event.stopPropagation()">' +
        '<div class="topic-header" onclick="this.parentElement.classList.toggle(\'expanded\')"><span class="arrow">▶</span>' + escHtml(tp.title) + '</div>' +
        '<div class="topic-entries">' + entriesHtml + '</div></div>';
    }).join('');

    return '<div class="theme-card expanded" data-theme="' + escHtml(t.title) + '">' +
      '<div class="theme-card-header" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
      '<span class="icon" style="background:var(--' + (getTagClass(t.title) === 'geopolitics' ? 'accent' : 'blue') + '-light)">' + icon + '</span>' +
      '<span class="theme-card-title">' + escHtml(t.title) + '</span>' +
      '<span class="theme-card-count">' + t.topics.length + '个话题</span>' +
      '<span class="theme-card-arrow">▼</span></div>' +
      '<div class="theme-card-body">' + topicsHtml + '</div></div>';
  }).join('');

  content.innerHTML = '<div class="theme-grid">' + cards + '</div>';
}

function renderTimeline(content, themes) {
  // Collect all timeline entries from filtered themes
  const dateMap = {};
  for (const theme of themes) {
    for (const topic of theme.topics) {
      // Re-extract dates on the fly since we stripped _dates
      const dates = [];
      const text = topic.title + ' ' + topic.entries.join(' ');
      const re = /(\d{1,2})\/(\d{1,2})/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const month = parseInt(m[1]), day = parseInt(m[2]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const year = month <= 7 ? 2026 : 2025;
          dates.push(year + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0'));
        }
      }
      const uniqueDates = [...new Set(dates)];
      for (const d of uniqueDates) {
        if (!dateMap[d]) dateMap[d] = [];
        dateMap[d].push({ theme: theme.title, topic: topic.title, entries: topic.entries, icon: THEME_ICONS[theme.title] || '📄' });
      }
    }
  }

  const sorted = Object.entries(dateMap).sort((a, b) => b[0].localeCompare(a[0]));

  if (sorted.length === 0) {
    content.innerHTML = '<div class="no-results"><div class="icon">📅</div><p>没有找到带日期标注的条目</p></div>';
    return;
  }

  const html = '<div class="timeline-list">' + sorted.map(([date, items]) => {
    return '<div class="timeline-date-group">' +
      '<div class="timeline-date-label">📌 ' + date + ' <span class="weekday">' + getWeekday(date) + '</span><span style="margin-left:auto;font-size:11px;color:var(--text-secondary);font-weight:400">' + items.length + '条</span></div>' +
      '<div class="timeline-cards">' + items.map(item => {
        const preview = item.entries.slice(0, 5);
        return '<div class="timeline-card">' +
          '<div class="timeline-card-header">' +
          '<span class="timeline-card-theme tag-' + getTagClass(item.theme) + '">' + (item.icon || '') + ' ' + escHtml(item.theme) + '</span>' +
          '<span class="timeline-card-topic">' + escHtml(item.topic) + '</span>' +
          (item.entries.length > 5 ? '<span class="timeline-card-count">+更多</span>' : '') +
          '</div>' +
          '<div class="timeline-card-body">' + preview.map(e => '<div class="timeline-entry">' + escHtml(e) + '</div>').join('') + '</div>' +
          '</div>';
      }).join('') +
      '</div></div>';
  }).join('') + '</div>';

  content.innerHTML = html;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Init
render();
</script>
</body>
</html>`;

fs.writeFileSync(OUTPUT, html, 'utf-8');
console.log('✅ 脑图浏览网站已生成: ' + OUTPUT);
console.log('   主题数: ' + data.meta.totalThemes);
console.log('   条目数: ' + data.meta.totalEntries);
console.log('   时间线节点: ' + data.timeline.length);
