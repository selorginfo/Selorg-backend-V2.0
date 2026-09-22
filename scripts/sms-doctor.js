/**
 * SMS delivery doctor — answers "is OTP SMS actually being delivered?" using the
 * provider's own records, which is the only source of truth. `/auth/send-otp`
 * returning 200 does not mean an SMS arrived.
 *
 * Read-only by default. Prints no secrets.
 *
 *   node scripts/sms-doctor.js            # config + account + recent delivery log
 *   node scripts/sms-doctor.js +91XXXXXXXXXX   # also send one real probe message
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.resolve(__dirname, '..', '.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const sid = env.TWILIO_ACCOUNT_SID || '';
const token = env.TWILIO_AUTH_TOKEN || '';
const from = env.TWILIO_SMS_FROM || env.TWILIO_PHONE_NUMBER || env.TWILIO_FROM || '';
const auth = Buffer.from(`${sid}:${token}`).toString('base64');
const mask = (n) => String(n).replace(/^(\+\d{2})\d+(\d{3})$/, '$1*******$2');

function call(method, host, p, body) {
  return new Promise((resolve, reject) => {
    const headers = { Authorization: `Basic ${auth}` };
    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request({ hostname: host, path: p, method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(d);
        } catch {}
        resolve({ status: res.statusCode, json, raw: d });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  console.log('=== PROVIDER CONFIG ===');
  console.log('SMS_VENDOR_URL   :', env.SMS_VENDOR_URL ? 'SET' : 'not set');
  console.log('MSG91_AUTH_KEY   :', env.MSG91_AUTH_KEY ? 'SET' : 'not set');
  console.log('MSG91_SENDER     :', env.MSG91_SENDER || 'not set');
  console.log('MSG91_TEMPLATE_ID:', env.MSG91_TEMPLATE_ID || 'not set  <- DLT template required for +91');
  console.log('FAST2SMS_API_KEY :', env.FAST2SMS_API_KEY ? 'SET' : 'not set');
  console.log('TWILIO           :', sid ? `SET (${sid.slice(0, 6)}...${sid.slice(-4)})` : 'not set');
  console.log('TWILIO from      :', from || 'not set');

  if (!sid || !token) {
    console.log('\nNo Twilio credentials — nothing further to check.');
    return;
  }

  const acct = await call('GET', 'api.twilio.com', `/2010-04-01/Accounts/${sid}.json`);
  console.log('\n=== ACCOUNT ===');
  console.log('type  :', acct.json?.type, '| status:', acct.json?.status);
  if (acct.json?.type === 'Trial') {
    console.log('WARNING: Trial accounts can ONLY deliver to numbers on the verified list below.');
    console.log('         Every other destination fails with error 21608 and no SMS is sent.');
    const v = await call('GET', 'api.twilio.com', `/2010-04-01/Accounts/${sid}/OutgoingCallerIds.json?PageSize=50`);
    const ids = v.json?.outgoing_caller_ids || [];
    console.log('verified numbers:', ids.length ? ids.map((c) => mask(c.phone_number)).join(', ') : '(none)');
  }

  const bal = await call('GET', 'api.twilio.com', `/2010-04-01/Accounts/${sid}/Balance.json`);
  console.log('balance:', bal.json?.balance, bal.json?.currency);

  console.log('\n=== RECENT DELIVERY LOG (ground truth) ===');
  const msgs = await call('GET', 'api.twilio.com', `/2010-04-01/Accounts/${sid}/Messages.json?PageSize=20`);
  const list = msgs.json?.messages || [];
  if (!list.length) console.log('(no messages)');
  list.forEach((m) =>
    console.log(`${m.date_sent} to=${mask(m.to)} status=${String(m.status).padEnd(10)} err=${m.error_code || '-'}`),
  );
  const failed = list.filter((m) => m.status === 'failed' || m.status === 'undelivered').length;
  console.log(`\nSummary: ${list.length - failed}/${list.length} delivered, ${failed} failed.`);

  const probe = process.argv[2];
  if (!probe) {
    console.log('\n(pass a destination number to send a real probe SMS)');
    return;
  }

  console.log(`\n=== PROBE SEND -> ${mask(probe)} ===`);
  const payload = new URLSearchParams({
    To: probe,
    From: from,
    Body: 'Selorg SMS delivery check. No action needed.',
  }).toString();
  const sent = await call('POST', 'api.twilio.com', `/2010-04-01/Accounts/${sid}/Messages.json`, payload);
  console.log('HTTP', sent.status, '| status:', sent.json?.status, '| error:', sent.json?.code || '-', sent.json?.message || '');
  if (!sent.json?.sid) return;

  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const m = await call('GET', 'api.twilio.com', `/2010-04-01/Accounts/${sid}/Messages/${sent.json.sid}.json`);
    console.log(`[poll] status=${m.json?.status} err=${m.json?.error_code || '-'}`);
    if (!['queued', 'accepted', 'sending'].includes(m.json?.status)) {
      console.log('\nFINAL:', m.json?.status);
      return;
    }
  }
})().catch((e) => {
  console.error('doctor failed:', e.message);
  process.exit(1);
});
