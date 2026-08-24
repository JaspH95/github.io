const routes = [];

export function route(pattern, handler) {
  // pattern like '/phase/:id' -> regex with named groups
  const paramNames = [];
  const regexStr = pattern.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1));
    return '([^/]+)';
  });
  const regex = new RegExp(`^${regexStr}$`);
  routes.push({ regex, paramNames, handler });
}

export function currentPath() {
  const hash = window.location.hash || '#/';
  return hash.slice(1) || '/';
}

export async function dispatch() {
  const path = currentPath();
  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      await r.handler(params);
      return;
    }
  }
  // no match: fall back to first route (home)
  if (routes.length) await routes[0].handler({});
}

export function startRouter() {
  window.addEventListener('hashchange', dispatch);
  if (!window.location.hash) window.location.hash = '#/';
  dispatch();
}
