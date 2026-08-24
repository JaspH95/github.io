export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function navigate(hash) {
  window.location.hash = hash;
}

let toastTimer = null;
export function toast(message, ms = 2600) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.getElementById('app-root').appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
}

export function formatRelativeDay(ts) {
  if (!ts) return 'never';
  const days = Math.round((ts - Date.now()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function phaseColorClass(color) {
  return color === 'lime' ? 'lime' : 'purple';
}
