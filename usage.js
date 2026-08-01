(() => {
  const USAGE_KEY = 'toolUsage';
  const MAX_COMMON = 8;

  function readUsage() {
    try {
      const value = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function writeUsage(value) {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(value));
    } catch {
      // localStorage 不可用时不影响工具本身使用。
    }
  }

  function recordUsage(id) {
    if (!id) return;
    const usage = readUsage();
    const old = usage[id] || {};
    usage[id] = {
      count: Math.max(0, Number(old.count) || 0) + 1,
      lastUsedAt: Date.now()
    };
    writeUsage(usage);
  }

  function getCommonTools() {
    const usage = readUsage();
    const favorites = new Set(store.get('favorites'));
    const recent = store.get('recent');
    const now = Date.now();

    return tools
      .filter(tool => usage[tool.id]?.count > 0)
      .map(tool => {
        const item = usage[tool.id];
        const ageDays = Math.max(0, (now - (item.lastUsedAt || 0)) / 86400000);
        const recencyScore = Math.max(0, 30 - Math.min(30, ageDays));
        const recentIndex = recent.indexOf(tool.id);
        const recentScore = recentIndex < 0 ? 0 : Math.max(0, 8 - recentIndex) * 2;
        const favoriteScore = favorites.has(tool.id) ? 25 : 0;
        const frequencyScore = Math.min(60, Math.log2(item.count + 1) * 15);
        return { tool, score: frequencyScore + recencyScore + recentScore + favoriteScore };
      })
      .sort((a, b) => b.score - a.score || (usage[b.tool.id]?.lastUsedAt || 0) - (usage[a.tool.id]?.lastUsedAt || 0))
      .slice(0, MAX_COMMON)
      .map(item => item.tool);
  }

  function ensureCommonSection() {
    if (document.querySelector('#common')) return;
    const favorites = document.querySelector('#favorites');
    if (!favorites) return;

    const title = document.createElement('div');
    title.className = 'section-title';
    title.innerHTML = '<h2>我的常用</h2><span>根据当前浏览器的使用习惯自动排序</span>';

    const grid = document.createElement('div');
    grid.id = 'common';
    grid.className = 'grid compact';

    favorites.parentNode.insertBefore(grid, favorites.previousElementSibling);
    favorites.parentNode.insertBefore(title, grid);
  }

  function renderCommon() {
    ensureCommonSection();
    const el = document.querySelector('#common');
    if (!el) return;
    const list = getCommonTools();
    el.innerHTML = list.length
      ? list.map(card).join('')
      : '<p>使用工具后，这里会自动显示当前浏览器最常用的工具。</p>';
  }

  const originalShowTool = window.showTool;
  if (typeof originalShowTool === 'function') {
    window.showTool = function enhancedShowTool(id) {
      recordUsage(id);
      originalShowTool(id);
      renderCommon();
    };
  }

  const originalRenderSaved = window.renderSaved;
  if (typeof originalRenderSaved === 'function') {
    window.renderSaved = function enhancedRenderSaved() {
      originalRenderSaved();
      renderCommon();
    };
  }

  window.addEventListener('storage', event => {
    if ([USAGE_KEY, 'favorites', 'recent'].includes(event.key)) renderCommon();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCommon, { once: true });
  } else {
    renderCommon();
  }
})();