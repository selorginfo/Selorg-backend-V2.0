import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

const MOUNTS = [
  { prefix: '/api/v1/customer/auth', file: 'modules/auth/auth.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/legal', file: 'modules/legal/legal.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/legal', file: 'modules/legal/legal.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/faq', file: 'modules/faq/faq.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/faq', file: 'modules/faq/faq.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/banners', file: 'modules/banners/banners.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/banners', file: 'modules/banners/banners.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/onboarding', file: 'modules/onboarding/onboarding.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/onboarding-pages', file: 'modules/onboarding/onboarding.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/user', file: 'modules/user/user.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/addresses', file: 'modules/addresses/addresses.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/notifications', file: 'modules/notifications/notifications.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/notifications', file: 'modules/notifications/notifications.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/sections', file: 'modules/home/sections.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/products', file: 'modules/products/products.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/categories', file: 'modules/categories/categories.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/categories', file: 'modules/categories/categories.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/cart', file: 'modules/cart/cart.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/orders', file: 'modules/orders/order.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/orders', file: 'modules/invoice/invoice.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/payments', file: 'modules/payments/payments.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/wallet', file: 'modules/wallet/wallet.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/coupons', file: 'modules/coupons/coupons.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/coupons', file: 'modules/coupons/coupons.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/refunds', file: 'modules/refunds/refunds.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/support', file: 'modules/support/support.routes.ts', router: 'router' },
  { prefix: '/api/v1/support', file: 'modules/support/support.routes.ts', router: 'publicRouter' },
  { prefix: '/api/v1/admin', file: 'modules/admin/admin.routes.ts', router: '__admin__' },
  { prefix: '/api/v1/rider', file: 'modules/rider/rider.routes.ts', router: 'router' },
  { prefix: '/api/v1/picker', file: 'modules/picker/picker.routes.ts', router: 'router' },
  { prefix: '/api/v1/admin/picker', file: 'modules/picker/picker.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/darkstore', file: 'modules/darkstore/darkstore.routes.ts', router: 'router' },
  { prefix: '/api/v1/admin/vendor', file: 'modules/vendor/vendor.routes.ts', router: 'router' },
  { prefix: '/api/v1/admin/finance', file: 'modules/finance/finance.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/home', file: 'modules/home/home.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/home', file: 'modules/home/home.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/admin/staff', file: 'modules/staff/staff.routes.ts', router: 'router' },
  { prefix: '/api/v1/rider/support-chat', file: 'modules/support-chat/support-chat.routes.ts', router: 'riderRouter' },
  { prefix: '/api/v1/admin/support-chat', file: 'modules/support-chat/support-chat.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/hhd', file: 'modules/hhd/hhd.routes.ts', router: 'router' },
  { prefix: '/api/v1/diag', file: 'routes/diag-order-flow.ts', router: 'diagOrderFlowRouter', nonProd: true },
  { prefix: '/api/v1/diag', file: 'routes/diag-hubs.ts', router: 'diagHubRouter', nonProd: true },
  { prefix: '/api/v1/logistics', file: 'modules/logistics/logistics.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/bootstrap', file: 'modules/bootstrap/bootstrap.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/delivery', file: 'modules/delivery/delivery.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/locations', file: 'modules/locations/locations.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/collections', file: 'modules/collections/collections.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/collections', file: 'modules/collections/collections.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/pages', file: 'modules/pages/pages.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/pages', file: 'modules/pages/pages.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/customer/admin/cms', file: 'modules/pages/cms.admin.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/store', file: 'modules/store/store.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/merch', file: 'modules/store/store.routes.ts', router: 'merchAdminRouter' },
  { prefix: '/api/v1/customer/admin/cancellation-policies', file: 'modules/app-config/app-config.routes.ts', router: 'cancellationPolicyAdminRouter' },
  { prefix: '/api/v1/customer/search', file: 'modules/products/search.routes.ts', router: 'router' },
  { prefix: '/api/v1/shared', file: 'modules/shared/shared.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/app-config', file: 'modules/app-config/app-config.routes.ts', router: 'router' },
  { prefix: '/api/v1/customer/admin/app-config', file: 'modules/app-config/app-config.routes.ts', router: 'adminRouter' },
  { prefix: '/api/v1/warehouse', file: 'modules/warehouse/warehouse.routes.ts', router: 'router' },
  { prefix: '/api/payment', file: 'modules/payments/payment-api.routes.ts', router: 'router' },
  { prefix: '/api/v1/merch', file: 'modules/merch/merch.routes.ts', router: 'router' },
  { prefix: '/api/v1/production', file: 'modules/production/production.routes.ts', router: 'router' },
  { prefix: '/api/v1/admin/products', file: 'modules/products/products.admin.routes.ts', router: 'router' },
];

function joinPaths(...parts) {
  return ('/' + parts.filter(Boolean).join('/')).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function getSpreadDefs(content) {
  const defs = {};
  for (const m of content.matchAll(/const\s+(authed|active|protected)\s*=\s*\[([^\]]+)\]/g)) {
    defs[m[1]] = m[2].split(',').map((s) => s.trim());
  }
  return defs;
}

function expandMw(str, spreadDefs) {
  const mw = [];
  for (const sm of str.matchAll(/\.\.\.(authed|active|protected)/g)) {
    if (spreadDefs[sm[1]]) mw.push(...spreadDefs[sm[1]]);
  }
  for (const t of ['authenticateAdmin', 'authenticateCustomer', 'authenticatePickerAllowSuspended', 'authenticatePicker', 'requireActivePicker', 'protect', 'authorize', 'hhdAuth', 'authenticateHHD']) {
    if (str.includes(t)) mw.push(t);
  }
  for (const m of str.matchAll(/requireRole\(([^)]+)\)/g)) mw.push(`requireRole(${m[1]})`);
  for (const m of str.matchAll(/requirePermission\([^)]+\)/g)) mw.push(m[0]);
  for (const m of str.matchAll(/authorize\([^)]+\)/g)) mw.push(m[0]);
  if (str.includes('validate(')) mw.push('validate');
  return [...new Set(mw)];
}

function classifyAuth(mw, inherited = []) {
  const all = [...inherited, ...mw];
  const s = all.join(' ');
  if (!all.length) return 'no';
  const hasAuth = /authenticateAdmin|authenticateCustomer|authenticatePicker|protect|hhdAuth|authenticateHHD/.test(s);
  const hasExtra = /requireActivePicker|requireRole|requirePermission|authorize/.test(s);
  if (hasAuth && hasExtra) return 'partial';
  if (/authenticatePickerAllowSuspended/.test(s) && !/\bauthenticatePicker\b/.test(s)) return 'partial';
  if (hasAuth) return 'yes';
  if (hasExtra) return 'partial';
  return 'no';
}

function extractRole(mw, inherited = []) {
  const all = [...inherited, ...mw];
  const roles = [];
  for (const m of all) {
    let rm = m.match(/requireRole\(([^)]+)\)/);
    if (rm) roles.push(rm[1].replace(/['"]/g, '').trim());
    rm = m.match(/authorize\(([^)]+)\)/);
    if (rm) roles.push(rm[1].replace(/USER_ROLE\./g, '').replace(/['"]/g, '').trim());
  }
  if (/authenticateAdmin/.test(all.join(' '))) roles.push('admin-jwt');
  if (/authenticatePicker/.test(all.join(' '))) roles.push('picker-jwt');
  if (/authenticateCustomer/.test(all.join(' '))) roles.push('customer-jwt');
  if (/protect/.test(all.join(' '))) roles.push('hhd-jwt');
  if (/requireActivePicker/.test(all.join(' '))) roles.push('active-picker');
  return roles.length ? [...new Set(roles)].join(';') : '-';
}

function extractHandler(rest) {
  if (/=>\s*\{/.test(rest)) return 'inline-handler';
  const matches = [...rest.matchAll(/([\w]+)\.([\w]+)/g)];
  if (matches.length) {
    const last = matches[matches.length - 1];
    return `${last[1]}.${last[2]}`;
  }
  const parts = rest.split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].replace(/\.\.\./g, '');
    if (/^[\w.]+$/.test(p) && !p.includes('(')) return p;
  }
  return 'unknown';
}

function inferService(handler, filePath) {
  if (handler === 'inline-handler' || handler === 'unknown') return '-';
  const mod = path.basename(filePath, '.ts').replace('.routes', '').replace('.admin', '');
  return `${mod}.service`;
}

function parseImports(content) {
  const imports = {};
  for (const m of content.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1].trim();
    const from = m[2];
    if (spec.startsWith('{')) {
      for (const part of spec.replace(/[{}]/g, '').split(',')) {
        const p = part.trim();
        if (!p) continue;
        const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim());
        imports[alias || orig] = from;
      }
    } else if (spec.includes(',')) {
      const [def, rest] = spec.split(',');
      imports[def.trim()] = from;
      const brace = rest.match(/\{([^}]+)\}/);
      if (brace) {
        for (const part of brace[1].split(',')) {
          const p = part.trim();
          if (!p) continue;
          const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim());
          imports[alias || orig] = from;
        }
      }
    } else {
      imports[spec] = from;
    }
  }
  return imports;
}

function resolveImport(fromFile, imp) {
  let p = imp.startsWith('.') ? path.resolve(path.dirname(fromFile), imp) : path.join(srcRoot, imp);
  if (!p.endsWith('.ts')) p += '.ts';
  return p;
}

function parseFileRoutes(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const spreadDefs = getSpreadDefs(content);
  const routerMw = {}; // routerName -> inherited middleware from .use(mw)
  const routerMounts = {}; // parent -> [{child, path}]
  const endpoints = [];

  // router.use(protect) or router.use('/x', child)
  for (const m of content.matchAll(/(\w+)\.use\(\s*(?:\/\*[\s\S]*?\*\/\s*)?(?:['"`]([^'"`]*?)['"`]\s*,\s*)?(\w+)\s*\)/g)) {
    const parent = m[1];
    const mountPath = m[2] ?? null;
    const child = m[3];
    if (['express', 'Router', 'validate', 'requirePermission', 'authenticateAdmin'].includes(child)) continue;
    if (mountPath !== null) {
      if (!routerMounts[parent]) routerMounts[parent] = [];
      routerMounts[parent].push({ child, path: mountPath });
    } else if (!child.endsWith('Router') && !child.endsWith('Routes') && child !== 'Router') {
      if (!routerMw[parent]) routerMw[parent] = [];
      routerMw[parent].push(child);
    } else if (mountPath === null || mountPath === undefined) {
      if (!routerMounts[parent]) routerMounts[parent] = [];
      routerMounts[parent].push({ child, path: '' });
    }
  }

  // Also: orderRouter.use(protect) single arg middleware
  for (const m of content.matchAll(/(\w+)\.use\(\s*(protect|authenticateAdmin|authenticatePicker|requireActivePicker)\s*\)/g)) {
    if (!routerMw[m[1]]) routerMw[m[1]] = [];
    routerMw[m[1]].push(m[2]);
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // .route('/').get(x).post(y)
    const routeChain = line.match(/(\w+)\.route\(\s*['"`]([^'"`]+)['"`]\s*\)(.*)/);
    if (routeChain) {
      const rn = routeChain[1];
      const rp = routeChain[2];
      let chain = routeChain[3];
      let j = i;
      while (!chain.includes(';') && j < lines.length - 1) {
        j++;
        chain += ' ' + lines[j].trim();
      }
      for (const cm of chain.matchAll(/\.(get|post|put|patch|delete)\(\s*([^,)]+)/g)) {
        const handler = extractHandler(cm[2]);
        const mw = expandMw(cm[2], spreadDefs);
        endpoints.push({ router: rn, method: cm[1].toUpperCase(), path: rp, handler, mw, line: i + 1, inherited: routerMw[rn] || [] });
      }
      continue;
    }

    const mm = line.match(/(\w+)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]\s*,(.*)$/);
    if (!mm) continue;
    let rest = mm[4];
    let j = i;
    while (!rest.includes(');') && j < lines.length - 1) {
      j++;
      rest += ' ' + lines[j].trim();
    }
    rest = rest.replace(/\);.*$/, '');
    endpoints.push({
      router: mm[1],
      method: mm[2].toUpperCase(),
      path: mm[3],
      handler: extractHandler(rest),
      mw: expandMw(rest, spreadDefs),
      line: i + 1,
      inherited: routerMw[mm[1]] || [],
    });
  }

  return { endpoints, routerMounts, routerMw, imports: parseImports(content), content };
}

function collectFromRouter(filePath, rootRouter, basePrefix, visited = new Set()) {
  const parsed = parseFileRoutes(filePath);
  const results = [];

  function walk(routerName, prefix, inherited) {
    const key = `${filePath}:${routerName}:${prefix}`;
    if (visited.has(key)) return;
    visited.add(key);

    for (const ep of parsed.endpoints.filter((e) => e.router === routerName)) {
      const fullMw = [...inherited, ...ep.inherited, ...ep.mw];
      results.push({
        method: ep.method,
        fullPath: joinPaths(prefix, ep.path),
        handler: ep.handler,
        auth: classifyAuth(ep.mw, [...inherited, ...ep.inherited]),
        role: extractRole(ep.mw, [...inherited, ...ep.inherited]),
        service: inferService(ep.handler, filePath),
        line: ep.line,
        router: routerName,
        notes: '',
      });
    }

    const mounts = parsed.routerMounts[routerName] || [];
    for (const m of mounts) {
      const childInherited = [...inherited, ...(parsed.routerMw[m.child] || [])];
      const childPath = joinPaths(prefix, m.path);

      // child is another router in same file
      if (parsed.endpoints.some((e) => e.router === m.child) || parsed.routerMounts[m.child]) {
        walk(m.child, childPath, childInherited);
      } else {
        // external file
        const imp = parsed.imports[m.child];
        if (imp) {
          const childFile = resolveImport(filePath, imp);
          if (fs.existsSync(childFile)) {
            results.push(...collectFromRouter(childFile, 'router', childPath, visited).map((r) => ({
              ...r,
              auth: classifyAuth([], childInherited) === 'no' && r.auth === 'no' ? 'no' : r.auth === 'no' ? classifyAuth([], childInherited) : r.auth,
              role: r.role === '-' ? extractRole([], childInherited) : r.role,
            })));
          }
        }
      }
    }
  }

  walk(rootRouter, basePrefix, []);
  return results;
}

const ADMIN_INTERNAL = {
  authRouter: '/auth',
  usersRouter: '/users',
  rolesRouter: '/roles',
  permissionsRouter: '/permissions',
  masterDataRoutes: '',
  storeWarehouseRoutes: '',
  storeWarehouseSubRoutes: '/store-warehouse',
  integrationRoutes: '/integrations',
  sessionsRouter: '/sessions',
  accessLogsRouter: '/access-logs',
  auditLogsRouter: '/audit',
  platformConfigRoutes: '/platform-config',
  appSettingsRoutes: '/app-settings',
  systemConfigRoutes: '/system',
  complianceRoutes: '/compliance',
  fraudRoutes: '/fraud',
  notificationCampaignRoutes: '/notifications',
  analyticsRoutes: '/analytics',
  riderMasterDataRouter: '/riders',
  supportRouter: '/support',
  customersRouter: '/customers',
  adminOrdersRouter: '/orders',
  pickerOpsRouter: '/picker',
  pickerApprovalsAlias: '/pickers',
  trainingVideosRouter: '/training-videos',
  pickerConfigRouter: '/picker-config',
  pickerActionLogsRouter: '/picker-action-logs',
  cacheRouter: '/cache',
  applicationsRouter: '/applications',
  protectedRouter: '',
};

function parseAdminRoutes(filePath, prefix) {
  const parsed = parseFileRoutes(filePath);
  const results = [];
  const protectedBase = ['authenticateAdmin', 'requireRole(admin, super_admin)'];

  for (const [router, mount] of Object.entries(ADMIN_INTERNAL)) {
    if (router === 'authRouter') {
      for (const ep of parsed.endpoints.filter((e) => e.router === router)) {
        results.push({
          method: ep.method,
          fullPath: joinPaths(prefix, mount, ep.path),
          handler: ep.handler,
          auth: 'no',
          role: '-',
          service: inferService(ep.handler, filePath),
          notes: 'admin login/logout — no JWT',
        });
      }
      continue;
    }

    if (router.endsWith('Routes')) {
      const imp = parsed.imports[router];
      if (!imp) continue;
      const childFile = resolveImport(filePath, imp);
      if (!fs.existsSync(childFile)) continue;
      const childEps = collectFromRouter(childFile, 'router', joinPaths(prefix, mount), new Set());
      for (const ep of childEps) {
        results.push({
          ...ep,
          auth: ep.auth === 'no' ? 'yes' : ep.auth,
          role: ep.role === '-' ? 'admin|super_admin' : ep.role,
          notes: path.basename(childFile),
        });
      }
      continue;
    }

    const isAlias = router === 'pickerApprovalsAlias';
    for (const ep of parsed.endpoints.filter((e) => e.router === router)) {
      const extraNotes = [];
      const mockPath =
        router === 'applicationsRouter' ||
        (router === 'protectedRouter' &&
          (/^\/system\/(instances|logs|api-endpoints|migrations)/.test(ep.path) ||
            /^\/system\/cache\//.test(ep.path)));
      if (mockPath) extraNotes.push('MOCK/stub hardcoded success');
      if (isAlias) extraNotes.push('alias of /admin/picker/pickers/*');
      if (router === 'protectedRouter') extraNotes.push('inline on protectedRouter');
      results.push({
        method: ep.method,
        fullPath: joinPaths(prefix, mount, ep.path),
        handler: ep.handler,
        auth: router === 'protectedRouter' || router === 'cacheRouter' ? (ep.mw.some((m) => m.startsWith('requirePermission')) ? 'partial' : 'yes') : 'yes',
        role: ep.mw.some((m) => m.startsWith('requirePermission')) ? 'admin|super_admin;permission-gated' : 'admin|super_admin',
        service: inferService(ep.handler, filePath),
        notes: extraNotes.join('; ') || 'protectedRouter',
      });
    }
  }
  return results;
}

const all = [];

// app.ts health
all.push(
  { method: 'GET', fullPath: '/health', module: 'health', auth: 'no', role: '-', handler: 'inline-handler', service: '-', notes: 'app.ts' },
  { method: 'GET', fullPath: '/healthz', module: 'health', auth: 'no', role: '-', handler: 'inline-handler', service: '-', notes: 'app.ts' },
  { method: 'GET', fullPath: '/health/db', module: 'health', auth: 'no', role: '-', handler: 'inline-handler', service: '-', notes: 'app.ts' },
  { method: 'GET', fullPath: '/health/ready', module: 'health', auth: 'no', role: '-', handler: 'inline-handler', service: '-', notes: 'app.ts' },
);

for (const mount of MOUNTS) {
  const filePath = path.join(srcRoot, mount.file);
  if (!fs.existsSync(filePath)) {
    console.error('Missing file', filePath);
    continue;
  }
  const mod = mount.file.split('/')[1] || 'unknown';

  let eps;
  if (mount.router === '__admin__') {
    eps = parseAdminRoutes(filePath, mount.prefix);
  } else {
    eps = collectFromRouter(filePath, mount.router, mount.prefix);
  }

  for (const ep of eps) {
    all.push({
      ...ep,
      module: mod,
      notes: [ep.notes, mount.nonProd ? 'non-production only' : ''].filter(Boolean).join('; ') || '-',
    });
  }
}

const counts = {};
for (const e of all) counts[e.module] = (counts[e.module] || 0) + 1;

const mountedFiles = new Set(MOUNTS.map((m) => m.file));
const allRouteFiles = [];
function walkDir(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walkDir(p);
    else if (/routes\.ts$|\.routes\.ts$/.test(ent.name)) allRouteFiles.push(path.relative(srcRoot, p).replace(/\\/g, '/'));
  }
}
walkDir(path.join(srcRoot, 'modules'));
walkDir(path.join(srcRoot, 'routes'));

const adminNested = [
  'modules/admin/master-data.routes.ts', 'modules/admin/store-warehouse.routes.ts',
  'modules/admin/store-warehouse-sub.routes.ts', 'modules/admin/integration.routes.ts',
  'modules/admin/platform-config.routes.ts', 'modules/admin/app-settings.routes.ts',
  'modules/admin/system-config.routes.ts', 'modules/admin/compliance.routes.ts',
  'modules/admin/fraud.routes.ts', 'modules/admin/notification-campaign.routes.ts',
  'modules/admin/analytics.routes.ts', 'modules/admin/activity-logs.routes.ts',
];

// debug one file
if (process.argv.includes('--debug')) {
  const fp = path.join(srcRoot, 'modules/admin/admin.routes.ts');
  const p = parseFileRoutes(fp);
  console.log('protectedRouter endpoints', p.endpoints.filter((e) => e.router === 'protectedRouter').length);
  console.log(p.endpoints.filter((e) => e.router === 'protectedRouter').map((e) => e.method + ' ' + e.path));
}

const sorted = [...all].sort((a, b) => a.fullPath.localeCompare(b.fullPath) || a.method.localeCompare(b.method));

// dedupe analysis
const pathIndex = {};
for (const e of sorted) {
  const k = `${e.method} ${e.fullPath}`;
  if (!pathIndex[k]) pathIndex[k] = [];
  pathIndex[k].push(e);
}

const outDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const tsvHeader = 'METHOD\tFULL_PATH\tMODULE\tAUTH\tROLE\tCONTROLLER_HANDLER\tSERVICE\tNOTES';
const tsvLines = sorted.map((e) =>
  [e.method, e.fullPath, e.module, e.auth, e.role, e.handler, e.service, e.notes]
    .map((v) => String(v).replace(/\t/g, ' '))
    .join('\t'),
);
fs.writeFileSync(path.join(outDir, 'endpoint-inventory.tsv'), [tsvHeader, ...tsvLines].join('\n'), 'utf8');

const summary = {
  totalEndpoints: sorted.length,
  uniqueMethodPath: Object.keys(pathIndex).length,
  duplicateMethodPathPairs: Object.values(pathIndex).filter((v) => v.length > 1).length,
  countsByModule: counts,
  unmountedRouteFiles: allRouteFiles.filter((f) => !mountedFiles.has(f) && !adminNested.includes(f)),
  adminNestedRouteFiles: adminNested,
};
fs.writeFileSync(path.join(outDir, 'endpoint-inventory-summary.json'), JSON.stringify(summary, null, 2), 'utf8');

console.log('TOTAL:', sorted.length);
console.log('UNIQUE_METHOD_PATH:', summary.uniqueMethodPath);
console.log('DUPLICATE_PAIRS:', summary.duplicateMethodPathPairs);
console.log('COUNTS:', JSON.stringify(counts, null, 2));
console.log('WROTE:', path.join(outDir, 'endpoint-inventory.tsv'));
console.log('---INVENTORY---');
for (const e of sorted) {
  console.log(`${e.method} | ${e.fullPath} | ${e.module} | ${e.auth} | ${e.role} | ${e.handler} | ${e.service} | ${e.notes}`);
}
console.log('---UNMOUNTED---');
for (const f of summary.unmountedRouteFiles) console.log('UNMOUNTED:', f);
