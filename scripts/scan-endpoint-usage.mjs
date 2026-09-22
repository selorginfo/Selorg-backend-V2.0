import fs from 'fs';
import path from 'path';

const OUT_PATH =
  'C:/Users/lmbac/Desktop/Selorg V1.3/selorg-service/docs/endpoint-usage-by-app.json';

const APPS = {
  'customer-app': {
    root: 'C:/Users/lmbac/Desktop/Selorg V1.3/selorg-customer-app',
    scanDirs: ['src'],
    basePrefix: '/api/v1/customer',
    exclude: ['node_modules', '.bundle', 'android', 'ios', '__tests__', 'coverage', '.expo'],
  },
  'customer-web': {
    root: 'C:/Users/lmbac/Desktop/Selorg V1.3/Selorg Webapp V1.3',
    scanDirs: ['src/services'],
    basePrefix: '/api/v1/customer',
    exclude: ['node_modules', '.next', '.expo', 'coverage'],
  },
  'picker-app': {
    root: 'C:/Users/lmbac/Desktop/Selorg V1.3/Selorg PickerApp V1.3',
    scanDirs: ['src'],
    basePrefix: '/api/v1/picker',
    exclude: ['node_modules', '.expo', 'android', 'ios', '_source', 'coverage'],
  },
  'rider-app': {
    root: 'C:/Users/lmbac/Desktop/Selorg V1.3/Selorg-RiderApp-v1.3',
    scanDirs: ['src'],
    basePrefix: '/api/v1',
    exclude: ['node_modules', '.expo', 'android', 'ios', 'coverage'],
  },
  'hhd-app': {
    root: 'C:/Users/lmbac/Desktop/Selorg V1.3/Selorg HSD-app V1.3',
    scanDirs: ['src'],
    basePrefix: '/api/v1/hhd',
    exclude: ['node_modules', '.expo', 'android', 'ios', 'coverage'],
  },
  'admin-dashboard': {
    root: 'C:/js/selorgdashboard',
    scanDirs: ['src'],
    basePrefix: null,
    exclude: ['node_modules', '.next', 'dist', 'coverage', 'design-reference'],
  },
};

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

function shouldExclude(fullPath, exclude) {
  const parts = fullPath.split(/[/\\]/);
  return exclude.some((e) => parts.includes(e));
}

function walk(dir, exclude, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (shouldExclude(fp, exclude)) continue;
    if (ent.isDirectory()) walk(fp, exclude, files);
    else if (EXT.has(path.extname(ent.name))) files.push(fp);
  }
  return files;
}

function normalizePath(p) {
  if (!p || typeof p !== 'string') return null;
  let s = p.trim();
  if (!s.startsWith('/')) s = `/${s}`;
  if (s.includes(' ')) s = s.split(' ')[0];
  s = s.split('?')[0];
  s = s.replace(/\$\{encodeURIComponent\([^)]+\)\}/g, ':id');
  s = s.replace(/\$\{[^}]+\}/g, ':id');
  if (s.includes('${')) s = s.slice(0, s.indexOf('${'));
  s = s.replace(/\.:id/g, '/:id');
  s = s.replace(/\/[a-f0-9]{24}(?=\/|$)/gi, '/:id');
  s = s.replace(/\/\d+(?=\/|$)/g, '/:id');
  s = s.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
    '/:id',
  );
  s = s.replace(/([^/:/]):id$/g, '$1');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s;
}

function isValidApiPath(p) {
  if (!p || !p.startsWith('/api/')) return false;
  if (p.includes('*') || p.includes(';') || p.includes('${') || p.includes(' ')) return false;
  if (p.endsWith('/account')) return false;
  if (/\/account\//.test(p) && !p.includes('/admin/')) return false;
  if (p.includes('socket.io')) return false;
  if (p === '/api/v1/customer/support') return false;
  if (p === '/api/v1/customer' || p === '/api/v1/picker/:id') return false;
  return true;
}

function joinPrefix(basePrefix, rel) {
  if (!rel.startsWith('/')) rel = `/${rel}`;
  if (!basePrefix) return normalizePath(rel);
  if (rel.startsWith('/api/')) return normalizePath(rel);
  return normalizePath(`${basePrefix.replace(/\/$/, '')}${rel}`);
}

function extractBaseConstants(content) {
  const bases = [];
  const re = /const\s+(?:BASE|base|BASE_URL|CUSTOMER_PREFIX|PICKER_API_BASE_PATH)\s*=\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(content)) !== null) bases.push(m[1]);
  return bases;
}

function extractPaths(content, basePrefix) {
  const found = new Set();
  const baseConsts = extractBaseConstants(content);

  const add = (raw) => {
    const n = normalizePath(raw);
    if (n && isValidApiPath(n)) found.add(n);
  };

  const addRel = (raw) => {
    if (!raw) return;
    const candidate = raw.startsWith('/api/')
      ? normalizePath(raw)
      : basePrefix
        ? joinPrefix(basePrefix, raw)
        : normalizePath(raw);
    if (candidate && isValidApiPath(candidate)) found.add(candidate);
  };

  // Full absolute paths in quotes or backticks
  const patterns = [
    /['"`](\/api(?:\/v1(?:\/[^'"`\s\\]+)+|\/payment[^'"`\s\\]*))['"`]/g,
    /`(\/api[^`$]+)`/g,
    /\$\{[^}]*(?:API_BASE|apiBaseUrl|resolveApiBaseUrl)[^}]*\}(\/api[^'"`\s]+)/g,
    /fetchWithHostFallback\s*\(\s*['"`](\/[^'"`\s$]+)['"`]/g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) add(m[1]);
  }

  // BASE constant + suffix templates
  for (const base of baseConsts) {
    add(base);
    const tplRe = new RegExp('`' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(/[^`]+)`', 'g');
    let m;
    while ((m = tplRe.exec(content)) !== null) {
      add(base + m[1].replace(/\$\{[^}]+\}/g, ':id'));
    }
    const concatRe = new RegExp('`' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/\\$\\{[^}]+\\}([^`]*?)`', 'g');
    while ((m = concatRe.exec(content)) !== null) {
      add(`${base}/:id${m[1]}`);
    }
  }

  // HTTP helper first-arg paths (quoted)
  const helperRes = [
    /(?:SelorgApi|apiClient)\.(?:get|post|put|patch|delete|update|postForm)\s*(?:<[^>]*>)?\s*\(\s*['"`](\/[^'"`\s$]+)['"`]/g,
    /(?:api(?:Get|Post|Put|Patch|Delete|GetBody|PostBody))\s*(?:<[^>]*>)?\s*\(\s*['"`](\/[^'"`\s$]+)['"`]/g,
    /(?:client|api)\.(?:get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*['"`](\/[^'"`\s$]+)['"`]/g,
    /(?:fetch|axios\.(?:get|post|put|patch|delete))\s*\(\s*['"`](\/[^'"`\s$]+)['"`]/g,
    /(?:request|requestPaginated|requestMultipart)\s*(?:<[^>]*>)?\s*\(\s*['"`](\/[^'"`\s$]+)['"`]/g,
    /(?:request|requestPaginated|requestMultipart)\s*\(\s*['"`](\/[^'"`\s$]+)['"`]/g,
  ];

  for (const re of helperRes) {
    let m;
    while ((m = re.exec(content)) !== null) addRel(m[1]);
  }

  // Template first-arg paths in helpers
  const tplHelperRes = [
    /(?:SelorgApi|apiClient|api(?:Get|Post|Put|Patch|Delete)|client|api|request|requestPaginated|requestMultipart)\.(?:get|post|put|patch|delete|update|postForm)?\s*(?:<[^>]*>)?\s*\(\s*`(\/[^`]+)`/g,
    /(?:api(?:Get|Post|Put|Patch|Delete|GetBody|PostBody))\s*(?:<[^>]*>)?\s*\(\s*`(\/[^`]+)`/g,
    /(?:request|requestPaginated|requestMultipart)\s*(?:<[^>]*>)?\s*\(\s*`(\/[^`]+)`/g,
    /(?:request|requestPaginated|requestMultipart)\s*\(\s*`(\/[^`]+)`/g,
  ];

  for (const re of tplHelperRes) {
    let m;
    while ((m = re.exec(content)) !== null) addRel(m[1]);
  }

  // Inline API paths only when already absolute
  const inlineApiRe = /['"`](\/api\/v1\/[^'"`\s$]+)['"`]/g;
  let m;
  while ((m = inlineApiRe.exec(content)) !== null) add(m[1]);

  // SelorgApi / apiClient template paths
  const selorgTplRe =
    /(?:SelorgApi|apiClient)\.(?:get|post|put|patch|delete|update|postForm)\s*(?:<[^>]*>)?\s*\(\s*`(\/[^`]+)`/g;
  while ((m = selorgTplRe.exec(content)) !== null) addRel(m[1]);

  // endpoint/url/path assignments
  const endpointRe = /(?:endpoint|url|path|route|PATH|URL|TEMPLATE_URL)\s*[:=]\s*['"`]?(\/[^'"`\s]+)/gi;
  while ((m = endpointRe.exec(content)) !== null) addRel(m[1]);

  return found;
}

const result = {
  scannedAt: new Date().toISOString(),
  apps: {},
  allUniquePaths: [],
  pathToApps: {},
};

const allPaths = new Map();

for (const [appKey, cfg] of Object.entries(APPS)) {
  const paths = new Set();
  for (const sd of cfg.scanDirs) {
    const dir = path.join(cfg.root, sd);
    const files = walk(dir, cfg.exclude);
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      for (const p of extractPaths(content, cfg.basePrefix)) paths.add(p);
    }
  }
  const sorted = [...paths].sort();
  result.apps[appKey] = { paths: sorted, count: sorted.length };
  for (const p of sorted) {
    if (!allPaths.has(p)) allPaths.set(p, new Set());
    allPaths.get(p).add(appKey);
  }
}

result.allUniquePaths = [...allPaths.keys()].sort();
for (const [p, apps] of [...allPaths.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  result.pathToApps[p] = [...apps].sort();
}

const riderPickerPaths = result.apps['rider-app'].paths.filter((p) => p.includes('/picker'));
const paymentApiPaths = result.allUniquePaths.filter((p) => p.startsWith('/api/payment'));

result.notes = {
  riderAppUsesPickerInfrastructure: riderPickerPaths.length > 0,
  riderAppPickerPaths: riderPickerPaths,
  riderAppPickerPathCount: riderPickerPaths.length,
  legacyPaymentApiPathsInFrontends: paymentApiPaths,
  scanScope: Object.fromEntries(
    Object.entries(APPS).map(([k, v]) => [k, { root: v.root, basePrefix: v.basePrefix }]),
  ),
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, `${JSON.stringify(result, null, 2)}\n`);

console.log('Written:', OUT_PATH);
for (const [k, v] of Object.entries(result.apps)) console.log(`${k}: ${v.count}`);
console.log('Total unique:', result.allUniquePaths.length);
console.log('Rider /picker refs:', riderPickerPaths.length);
