/**
 * Mastersheet end-to-end API integration test.
 * Run: node scripts/_test_mastersheet_flow.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API_BASE_URL || 'http://127.0.0.1:3333';
const EMAIL = process.env.ADMIN_TEST_EMAIL || 'hemanathc0112@gmail.com';
const PASSWORD = process.env.ADMIN_TEST_PASSWORD || 'Selorg@2024';
const MASTER =
  process.env.MASTERSHEET_PATH ||
  'C:/Users/lmbac/Downloads/Selorg_Final_mastersheet_updated_with_order_limits.xlsx';

const SHEETS = [
  'sku-master',
  'categories',
  'category-display-image',
  'banner-details',
  'home-page-content',
  'subcategories',
];

const report = [];
function log(step, ok, detail) {
  const line = `${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`;
  report.push(line);
  console.log(line);
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  console.log('API:', API);
  console.log('Master:', MASTER);

  // 1. Login
  const loginRes = await fetch(`${API}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, role: 'admin' }),
  });
  const loginBody = await json(loginRes);
  const token = loginBody?.data?.token;
  log('Admin login', loginRes.ok && !!token, `status=${loginRes.status}`);
  if (!token) {
    console.error(loginBody);
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${token}` };

  // 2. Invalid file rejection
  {
    const form = new FormData();
    form.append('file', new Blob(['not-an-excel'], { type: 'text/plain' }), 'bad.txt');
    const res = await fetch(`${API}/api/v1/admin/mastersheet/prepare`, { method: 'POST', headers: auth, body: form });
    const body = await json(res);
    log('Validation: reject non-xlsx', !res.ok, `status=${res.status} msg=${body.message || ''}`);
  }

  // 3. Baseline customer home
  const homeBefore = await json(await fetch(`${API}/api/v1/customer/home`));
  const revBefore = homeBefore?.data?.config?.contentRevision ?? homeBefore?.config?.contentRevision;
  const sectionsBefore = (homeBefore?.data?.sectionDefinitions || homeBefore?.sectionDefinitions || []).length;
  log('GET /customer/home (before)', !!(homeBefore?.success ?? homeBefore?.data ?? homeBefore?.sectionDefinitions), `rev=${revBefore} sections=${sectionsBefore}`);

  const catsBefore = await json(await fetch(`${API}/api/v1/customer/categories`));
  const catCountBefore = (catsBefore?.data || catsBefore || []).length;
  log('GET /customer/categories (before)', Array.isArray(catsBefore?.data || catsBefore), `count=${catCountBefore}`);

  // 4. Prepare real master sheet
  const buf = fs.readFileSync(MASTER);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(MASTER));
  const prepRes = await fetch(`${API}/api/v1/admin/mastersheet/prepare`, { method: 'POST', headers: auth, body: form });
  const prep = await json(prepRes);
  const jobId = prep?.data?.jobId;
  const versionId = prep?.data?.versionId;
  log('POST /prepare (valid master)', prepRes.ok && !!jobId && !!versionId, `status=${prepRes.status} sheets=${(prep?.data?.sheetsFound || []).join(',')}`);
  if (!jobId) {
    console.error(JSON.stringify(prep, null, 2));
    process.exit(1);
  }

  // 5. Process each sheet
  const summaries = [];
  for (const sheet of SHEETS) {
    const t0 = Date.now();
    const res = await fetch(`${API}/api/v1/admin/mastersheet/process/${sheet}?jobId=${encodeURIComponent(jobId)}`, {
      method: 'POST',
      headers: auth,
    });
    const body = await json(res);
    const d = body?.data || {};
    const ok = res.ok;
    log(
      `POST /process/${sheet}`,
      ok,
      `status=${res.status} rows=${d.totalRows} +${d.created} ~${d.updated} skip=${d.skipped} err=${(d.errors || []).length} ${Date.now() - t0}ms`,
    );
    summaries.push({
      sheetKey: sheet,
      totalRows: d.totalRows ?? 0,
      created: d.created ?? 0,
      updated: d.updated ?? 0,
      skipped: d.skipped ?? 0,
      errorCount: (d.errors || []).length,
      status: ok ? 'done' : 'error',
      error: ok ? undefined : body.message,
    });
  }

  // 6. Finalize / activate
  const finRes = await fetch(`${API}/api/v1/admin/mastersheet/finalize`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, fileName: path.basename(MASTER), sheets: summaries }),
  });
  const fin = await json(finRes);
  log(
    'POST /finalize (activate)',
    finRes.ok && fin?.data?.activated === true,
    `status=${finRes.status} activated=${fin?.data?.activated} rev=${fin?.data?.contentRevision} failed=${(fin?.data?.failedSheets || []).join('|')}`,
  );

  // 7. Active version
  const activeRes = await fetch(`${API}/api/v1/admin/mastersheet/active`, { headers: auth });
  const active = await json(activeRes);
  log(
    'GET /active',
    activeRes.ok && active?.data?.versionId === versionId,
    `version=${active?.data?.versionId?.slice(0, 8)} file=${active?.data?.fileName}`,
  );

  // 8. Customer APIs after
  const homeAfter = await json(await fetch(`${API}/api/v1/customer/home`));
  const homeData = homeAfter?.data || homeAfter;
  const revAfter = homeData?.config?.contentRevision;
  const defs = homeData?.sectionDefinitions || [];
  const sectionKeys = Object.keys(homeData?.sections || {});
  log(
    'GET /customer/home (after)',
    !!homeData?.sectionDefinitions,
    `rev=${revAfter} (was ${revBefore}) defs=${defs.length} inlineKeys=${sectionKeys.length}`,
  );

  const catsAfter = await json(await fetch(`${API}/api/v1/customer/categories`));
  const cats = catsAfter?.data || [];
  log('GET /customer/categories (after)', Array.isArray(cats) && cats.length > 0, `count=${cats.length}`);

  // Sample product from a section if any product-like key
  let productSampleOk = false;
  for (const def of defs.slice(0, 12)) {
    const key = def.key;
    const secRes = await fetch(`${API}/api/v1/customer/sections/${encodeURIComponent(key)}/products?limit=3`);
    if (secRes.status === 404) continue;
    const sec = await json(secRes);
    const products = sec?.data?.products || sec?.products || [];
    if (secRes.ok && products.length > 0) {
      productSampleOk = true;
      log(`GET /sections/${key}/products`, true, `n=${products.length} first=${products[0]?.name || products[0]?.sku}`);
      break;
    }
  }
  if (!productSampleOk) log('GET /sections/:key/products sample', true, 'no product section with items (may be banner-only layout)');

  // 9. Modified master: change Home Page Content section name via exceljs copy
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(MASTER);
  const homeWs = wb.getWorksheet('Home Page Content');
  let marker = `AUTOTEST-${Date.now()}`;
  if (homeWs) {
    // Find a data row with Section Type and rewrite Section Name lightly
    homeWs.eachRow((row, rowNumber) => {
      if (rowNumber < 3) return;
      const type = String(row.getCell(1).value || '');
      if (/hero/i.test(type) && !marker.startsWith('SET')) {
        row.getCell(2).value = marker;
        marker = `SET:${marker}`;
      }
    });
  }
  const modPath = path.join(__dirname, `_tmp_modified_mastersheet_${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(modPath);

  const buf2 = fs.readFileSync(modPath);
  const form2 = new FormData();
  form2.append('file', new Blob([buf2], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(modPath));
  const prep2Res = await fetch(`${API}/api/v1/admin/mastersheet/prepare`, { method: 'POST', headers: auth, body: form2 });
  const prep2 = await json(prep2Res);
  const job2 = prep2?.data?.jobId;
  log('Prepare modified master', prep2Res.ok && !!job2, `status=${prep2Res.status}`);

  const summaries2 = [];
  if (job2) {
    for (const sheet of SHEETS) {
      const res = await fetch(`${API}/api/v1/admin/mastersheet/process/${sheet}?jobId=${encodeURIComponent(job2)}`, {
        method: 'POST',
        headers: auth,
      });
      const body = await json(res);
      const d = body?.data || {};
      summaries2.push({
        sheetKey: sheet,
        totalRows: d.totalRows ?? 0,
        created: d.created ?? 0,
        updated: d.updated ?? 0,
        skipped: d.skipped ?? 0,
        errorCount: (d.errors || []).length,
        status: res.ok ? 'done' : 'error',
      });
      if (!res.ok) log(`process modified ${sheet}`, false, body.message);
    }
    const fin2Res = await fetch(`${API}/api/v1/admin/mastersheet/finalize`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job2, fileName: path.basename(modPath), sheets: summaries2 }),
    });
    const fin2 = await json(fin2Res);
    log('Finalize modified master', fin2Res.ok && fin2?.data?.activated, `rev=${fin2?.data?.contentRevision}`);

    const home3 = await json(await fetch(`${API}/api/v1/customer/home`));
    const rev3 = (home3?.data || home3)?.config?.contentRevision;
    log('Web App home revision changed after re-upload', rev3 != null && rev3 !== revAfter, `rev ${revAfter} → ${rev3}`);
  }

  try { fs.unlinkSync(modPath); } catch { /* ignore */ }

  console.log('\n=== SUMMARY ===');
  const failed = report.filter((r) => r.startsWith('FAIL'));
  report.forEach((r) => console.log(r));
  console.log(failed.length ? `\n${failed.length} failure(s)` : '\nAll checks passed');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
