import crypto from 'crypto';
import { logger } from '../../utils/logger';

/**
 * Ported field-for-field from legacy `worldlinePaymentsService.js` — the Paynimo/Worldline
 * token generation, response-hash verification, and gateway-payload normalization/status
 * mapping. This is the security-critical surface of the payments module: preserve the exact
 * algorithm, field ordering, and pipe-concatenation as legacy — do not "clean up".
 */

export function trimEnv(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function parseAlgoToken(raw: unknown): 'sh1' | 'sh2' | null {
  const a = String(raw || '').trim().toLowerCase();
  if (a === 'sh1' || a === 'sha256' || a === 'sha-256') return 'sh1';
  if (a === 'sh2' || a === 'sha512' || a === 'sha-512') return 'sh2';
  return null;
}

/**
 * Prefer WORLDLINE_HASH_ALGO on the server so PROD TEST vs live kits can be fixed without an
 * app release. Optional client `algo` only applies when env is unset. Default `sh2` → SHA-512.
 */
export function resolveWorldlineHashAlgo(requestAlgo?: unknown): 'sh1' | 'sh2' {
  const fromEnv = parseAlgoToken(process.env.WORLDLINE_HASH_ALGO);
  if (fromEnv) return fromEnv;
  const fromClient = parseAlgoToken(requestAlgo);
  if (fromClient) return fromClient;
  return 'sh2';
}

export function deviceIdForPlatform(platform: string, algo?: unknown): string | null {
  const resolved = resolveWorldlineHashAlgo(algo);
  const isSh1 = resolved === 'sh1';
  if (platform === 'web') return isSh1 ? 'WEBSH1' : 'WEBSH2';
  // Paynimo Android SDK native code samples use "AndroidSH1"/"AndroidSH2" (mixed case) —
  // documentation shows "ANDROIDSH1" but the actual SDK code uses this casing.
  if (platform === 'android') return isSh1 ? 'AndroidSH1' : 'AndroidSH2';
  if (platform === 'ios') return isSh1 ? 'iOSSH1' : 'iOSSH2';
  return null;
}

/** Paynimo: *SH1 suffix → SHA-256, *SH2 → SHA-512 (matches Worldline AndroidSH1/AndroidSH2 kits). */
export function hashForDeviceId(deviceId: string, value: unknown): string {
  const did = String(deviceId || '').toUpperCase();
  const algo = did.endsWith('SH1') ? 'sha256' : 'sha512';
  return crypto.createHash(algo).update(String(value), 'utf8').digest('hex');
}

export function canonicalizePaynimoPaymentMode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'all';
  const lower = raw.toLowerCase();
  if (lower === 'upi') return 'UPI';
  if (lower === 'netbanking' || lower === 'nb') return 'netBanking';
  if (lower === 'card' || lower === 'cards') return 'cards';
  if (lower === 'wallet' || lower === 'wallets') return 'wallets';
  if (lower === 'all' || lower === 'digital') return 'all';
  // Unknown / legacy order method strings must not reach Paynimo as-is —
  // invalid modes render an empty instrument list on the hosted checkout.
  return 'all';
}

/** Paynimo uses totalamount in the token string; amount must match item line(s), two decimals. */
export function formatWorldlineTxnAmount(amountInr: unknown): string {
  const n = Number(amountInr);
  if (!Number.isFinite(n) || n < 0) return '0.00';
  return (Math.round(n * 100) / 100).toFixed(2);
}

interface ComputeTokenInput {
  merchantId: string;
  txnId: string;
  totalAmount: string;
  consumerId: string;
  consumerMobileNo?: string;
  consumerEmailId?: string;
  salt: string;
  deviceId: string;
}

export function computeToken({
  merchantId,
  txnId,
  totalAmount,
  consumerId,
  consumerMobileNo,
  consumerEmailId,
  salt,
  deviceId,
}: ComputeTokenInput): string {
  // Paynimo spec (most fields optional -> keep empty string placeholders).
  const parts = [
    merchantId,
    txnId,
    totalAmount,
    '', // accountNo
    consumerId,
    consumerMobileNo || '',
    consumerEmailId || '',
    '', // debitStartDate
    '', // debitEndDate
    '', // maxAmount
    '', // amountType
    '', // frequency
    '', // cardNumber
    '', // expMonth
    '', // expYear
    '', // cvvCode
    salt,
  ];
  // Must be 17 segments (16 fields + salt); Paynimo rebuilds the same pipe string for validation.
  if (parts.length !== 17) {
    logger.warn('Worldline Paynimo token pipe segment count mismatch', { pipeCount: parts.length, expect: 17 });
  }
  return hashForDeviceId(deviceId, parts.join('|'));
}

export function computeResponseHash({
  msgOrder,
  response,
  salt,
  deviceId,
}: {
  msgOrder: string[];
  response: Record<string, unknown>;
  salt: string;
  deviceId: string;
}): string {
  const values = msgOrder.map((k) => (response?.[k] ?? ''));
  const toHash = `${values.join('|')}|${salt}`;
  return hashForDeviceId(deviceId, toHash);
}

function safeJsonParse(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Set true when `normalizeWorldlineGatewayPayload` merged a pipe-delimited `msg` (logging only). */
let lastWorldlineMsgPipeParsed = false;

/** Paynimo SDK `msg` pipe order (16 segments ending with response `hash`). */
export const WORLDLINE_PAYNIMO_MSG_PIPE_ORDER = [
  'txn_status',
  'txn_msg',
  'txn_err_msg',
  'clnt_txn_ref',
  'tpsl_bank_cd',
  'tpsl_txn_id',
  'txn_amt',
  'clnt_rqst_meta',
  'tpsl_txn_time',
  'bal_amt',
  'card_id',
  'alias_name',
  'BankTransactionID',
  'mandate_reg_no',
  'token',
  'hash',
];

/**
 * Parse Paynimo pipe-delimited `msg` (not JSON — does not start with '{').
 * When `clnt_rqst_meta` contains '|', tail fields are taken from the last 8 segments.
 */
export function parsePipeMsg(msgStr: unknown): Record<string, string> | null {
  if (!msgStr || typeof msgStr !== 'string') return null;
  if (msgStr.trimStart().startsWith('{')) return null;
  const parts = msgStr.split('|');
  const need = WORLDLINE_PAYNIMO_MSG_PIPE_ORDER.length;
  if (parts.length < need) return null;

  let parsed: Record<string, string>;
  if (parts.length === need) {
    parsed = {};
    WORLDLINE_PAYNIMO_MSG_PIPE_ORDER.forEach((key, i) => {
      parsed[key] = parts[i] ?? '';
    });
  } else {
    const N = parts.length;
    const metaEnd = N - (need - 8);
    parsed = {
      txn_status: parts[0] ?? '',
      txn_msg: parts[1] ?? '',
      txn_err_msg: parts[2] ?? '',
      clnt_txn_ref: parts[3] ?? '',
      tpsl_bank_cd: parts[4] ?? '',
      tpsl_txn_id: parts[5] ?? '',
      txn_amt: parts[6] ?? '',
      clnt_rqst_meta: parts.slice(7, metaEnd).join('|'),
      tpsl_txn_time: parts[N - 8] ?? '',
      bal_amt: parts[N - 7] ?? '',
      card_id: parts[N - 6] ?? '',
      alias_name: parts[N - 5] ?? '',
      BankTransactionID: parts[N - 4] ?? '',
      mandate_reg_no: parts[N - 3] ?? '',
      token: parts[N - 2] ?? '',
      hash: parts[N - 1] ?? '',
    };
  }

  const hashStr = String(parsed.hash || '');
  logger.info('Worldline parsePipeMsg', {
    pipeParsed: true,
    partCount: parts.length,
    parsedTxnStatus: parsed.txn_status,
    parsedTpslTxnId: parsed.tpsl_txn_id,
    parsedHashPrefix: hashStr ? hashStr.slice(0, 16) : '',
  });

  return parsed;
}

/**
 * Worldline / Paynimo POST bodies and RN SDK success callbacks vary:
 * - Pipe-delimited `msg` (most common from RN SDK): merchant_code + msg string
 * - JSON inside msg (legacy / some gateways)
 * - Mixed camelCase vs snake_case
 */
export function normalizeWorldlineGatewayPayload(raw: unknown): Record<string, unknown> {
  lastWorldlineMsgPipeParsed = false;
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};

  let merged: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  const mergeObj = (obj: unknown) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    merged = { ...merged, ...(obj as Record<string, unknown>) };
  };

  for (const nestKey of ['paymentResponse', 'payment_response', 'data', 'body', 'result', 'gatewayResponse']) {
    const v = merged[nestKey];
    if (v && typeof v === 'object' && !Array.isArray(v)) mergeObj(v);
  }

  const MSG_KEYS = ['msg', 'message', 'MSG', 'responseMsg', 'respMsg'];
  for (const msgKey of MSG_KEYS) {
    const val = merged[msgKey];
    if (val && typeof val === 'string') {
      const pipeParsed = parsePipeMsg(val);
      if (pipeParsed) {
        merged = { ...merged, ...pipeParsed };
        lastWorldlineMsgPipeParsed = true;
        break;
      }
    }
  }

  for (let round = 0; round < 8; round++) {
    const before = JSON.stringify(merged);
    for (const msgKey of MSG_KEYS) {
      const val = merged[msgKey];
      if (val && typeof val === 'string' && val.trimStart().startsWith('{')) {
        const parsed = safeJsonParse(val);
        if (parsed) merged = { ...merged, ...parsed };
      }
    }
    if (JSON.stringify(merged) === before) break;
  }

  const pick = (...candidates: unknown[]): string => {
    for (const c of candidates) {
      if (c == null) continue;
      const s = String(c).trim();
      if (s !== '') return s;
    }
    return '';
  };

  return {
    ...merged,
    txn_status: pick(merged.txn_status, merged.txnStatus, merged.TXN_STATUS, merged.status, merged.statusCode),
    txn_msg: pick(merged.txn_msg, merged.txnMsg, merged.TXN_MSG),
    txn_err_msg: pick(merged.txn_err_msg, merged.txnErrMsg, merged.TXN_ERR_MSG),
    clnt_txn_ref: pick(merged.clnt_txn_ref, merged.clntTxnRef, merged.CLNT_TXN_REF, merged.txnId, merged.TXN_ID),
    tpsl_bank_cd: pick(merged.tpsl_bank_cd, merged.tpslBankCd, merged.TPSL_BANK_CD),
    tpsl_txn_id: pick(merged.tpsl_txn_id, merged.tpslTxnId, merged.TPSL_TXN_ID, merged.tpsl_txnId),
    txn_amt: pick(merged.txn_amt, merged.txnAmt, merged.TXN_AMT, merged.amount),
    clnt_rqst_meta: pick(merged.clnt_rqst_meta, merged.clntRqstMeta, merged.CLNT_RQST_META),
    tpsl_txn_time: pick(merged.tpsl_txn_time, merged.tpslTxnTime, merged.TPSL_TXN_TIME),
    bal_amt: pick(merged.bal_amt, merged.balAmt, merged.BAL_AMT),
    card_id: pick(merged.card_id, merged.cardId, merged.CARD_ID),
    alias_name: pick(merged.alias_name, merged.aliasName, merged.ALIAS_NAME),
    BankTransactionID: pick(merged.BankTransactionID, merged.bankTransactionId, merged.bank_transaction_id),
    mandate_reg_no: pick(merged.mandate_reg_no, merged.mandateRegNo, merged.MANDATE_REG_NO),
    token: pick(merged.token, merged.TOKEN),
    hash: pick(merged.hash, merged.HASH),
  };
}

function logWorldlinePostNormalize(context: string, rawKeys: string[], normalized: Record<string, unknown>): void {
  const n = normalized || {};
  const hasTxnStatus = String(n.txn_status || '').trim() !== '';
  const hasHash = String(n.hash || n.HASH || '').trim() !== '';
  const hashStr = String(n.hash || n.HASH || '');
  logger.info('Worldline post-normalize (verification fields)', {
    context,
    rawKeys,
    normalizedKeys: Object.keys(n),
    hasTxnStatus,
    hasHash,
    pipeParsed: lastWorldlineMsgPipeParsed,
    parsedTxnStatus: String(n.txn_status || '').trim(),
    parsedTpslTxnId: String(n.tpsl_txn_id || '').trim(),
    parsedHashPrefix: hashStr ? hashStr.slice(0, 16) : '',
  });
}

export function logWorldlineCallbackPayload(context: string, raw: unknown): void {
  const rawObj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const rawKeys = Object.keys(rawObj);
  const msgVal = rawObj.msg;
  logger.info('Worldline callback payload (raw)', {
    context,
    rawKeyCount: rawKeys.length,
    rawKeys,
    msgIsString: typeof msgVal === 'string',
    msgLooksLikePipe: typeof msgVal === 'string' && msgVal.trimStart().length > 0 && !msgVal.trimStart().startsWith('{'),
    rawBodyJson: (() => {
      try {
        return JSON.stringify(raw);
      } catch (e) {
        return `[non-serializable: ${(e as Error)?.message || e}]`;
      }
    })(),
  });
}

function incompleteWorldlineVerificationPayload(normalized: Record<string, unknown>): boolean {
  const hasHash = String(normalized?.hash || normalized?.HASH || '').trim() !== '';
  const hasTxnStatus = String(normalized?.txn_status || '').trim() !== '';
  return !hasHash && !hasTxnStatus;
}

export const WORLDLINE_ERROR_INCOMPLETE_NORMALIZE = 'Unusable payload: txn_status/hash not found after normalization';
export const WORLDLINE_ERROR_HASH_MISMATCH_EMPTY_TPSL = 'hash_mismatch: tpsl_txn_id missing, likely msg was not parsed correctly';

/**
 * Official Paynimo txn_status semantics:
 * 0300 = Success, 0398 = Initiated, 0399 = Failure, 0396 = Awaited, 0392 = Aborted.
 * "Awaited" (0396) means the bank/UPI confirmation is still pending — it must map to
 * `pending`, never `failed`, or genuine payments get voided while still in flight.
 */
export function mapStatus(statusCodeOrTxnStatus: unknown): 'success' | 'cancelled' | 'pending' | 'failed' | 'unknown' {
  const code = String(statusCodeOrTxnStatus || '').trim();
  const lower = code.toLowerCase();
  if (code === '0300' || lower === 'success') return 'success';
  if (
    code === '0392' ||
    code === '0002' ||
    lower === 'cancelled' ||
    lower === 'canceled' ||
    lower === 'cancel' ||
    lower === 'user_cancelled' ||
    lower === 'user_canceled' ||
    lower === 'aborted' ||
    lower === 'abort'
  ) {
    return 'cancelled';
  }
  if (code === '0396' || code === '0398' || lower === 'pending') return 'pending';
  if (code === '0399' || lower === 'failed' || lower === 'failure' || lower === 'error' || lower === 'timeout') {
    return 'failed';
  }
  if (!code) return 'unknown';
  return 'failed';
}

export function mapStatusLabel(statusCode: unknown): string {
  const code = String(statusCode || '').trim();
  const statusLabelMap: Record<string, string> = {
    '0300': 'Captured',
    '0392': 'Cancelled by User',
    '0396': 'Awaited (Pending Confirmation)',
    '0398': 'Pending',
    '0399': 'Failed',
    '0002': 'Cancelled',
  };
  return statusLabelMap[code] || 'Unknown';
}

export function formatTimeElapsed(secondsInput: unknown): string {
  const seconds = Math.max(0, Math.floor(Number(secondsInput) || 0));
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  return `${Math.floor(seconds / 86400)} days`;
}

export function isTerminal(status: unknown): boolean {
  return status === 'success' || status === 'failed' || status === 'cancelled';
}

interface PaymentLike {
  status?: string;
  statusCode?: string;
  verificationError?: string;
  statusMessage?: string;
  lastFailureReason?: string;
  sessionExpiresAt?: Date | string | null;
}

/**
 * Canonical payment outcome for client UI (retry screen, toasts, navigation).
 * Values: SUCCESS | PENDING | AWAITING_PAYMENT | INITIATED | FAILED |
 *         CANCELLED | USER_CANCELLED | ABORTED | TIMEOUT
 */
export function resolvePaymentOutcome(payment: PaymentLike | null | undefined): string {
  if (!payment) return 'AWAITING_PAYMENT';

  const status = String(payment.status || '').toLowerCase();
  const statusCode = String(payment.statusCode || '').trim();
  const verificationError = String(payment.verificationError || 'none').toLowerCase();
  const msg = String(payment.statusMessage || payment.lastFailureReason || '').toLowerCase();
  const expiresAt = payment.sessionExpiresAt ? new Date(payment.sessionExpiresAt).getTime() : null;
  const isExpired = expiresAt != null && Number.isFinite(expiresAt) && Date.now() > expiresAt;

  if (status === 'success' && verificationError === 'none') return 'SUCCESS';
  if (status === 'success') return 'PENDING';
  if (status === 'pending') return 'PENDING';

  if (isExpired && !isTerminal(status)) return 'TIMEOUT';
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('took too long') || msg.includes('session expired')) {
    return 'TIMEOUT';
  }

  if (status === 'cancelled') {
    if (statusCode === '0392' || msg.includes('user cancel') || msg.includes('cancelled by user')) return 'USER_CANCELLED';
    if (msg.includes('abort')) return 'ABORTED';
    return 'CANCELLED';
  }

  if (status === 'failed') return 'FAILED';
  if (status === 'initiated') return 'INITIATED';
  if (status === 'created') return 'AWAITING_PAYMENT';
  if (status === 'unknown') return 'PENDING';

  return 'AWAITING_PAYMENT';
}

interface VerifyGatewayResponseInput {
  payment: { amountInr: number | string; deviceId: string };
  response: unknown;
  salt: string;
  logContext?: string;
}

export interface VerifyGatewayResponseResult {
  hashOk: boolean;
  amountOk: boolean;
  verificationError: 'none' | 'hash_mismatch' | 'amount_mismatch';
  receivedHash: string;
  normalized: Record<string, unknown>;
  payloadError: string | null;
  statusCode: string;
  statusMessage: string;
}

export function verifyGatewayResponse({ payment, response, salt, logContext }: VerifyGatewayResponseInput): VerifyGatewayResponseResult {
  const rawKeys = response && typeof response === 'object' && !Array.isArray(response) ? Object.keys(response as object) : [];
  const normalized = normalizeWorldlineGatewayPayload(response);
  logWorldlinePostNormalize(logContext || 'verifyGatewayResponse', rawKeys, normalized);

  const msgOrder = [
    'txn_status',
    'txn_msg',
    'txn_err_msg',
    'clnt_txn_ref',
    'tpsl_bank_cd',
    'tpsl_txn_id',
    'txn_amt',
    'clnt_rqst_meta',
    'tpsl_txn_time',
    'bal_amt',
    'card_id',
    'alias_name',
    'BankTransactionID',
    'mandate_reg_no',
    'token',
  ];

  const expectedHash = computeResponseHash({ msgOrder, response: normalized, salt, deviceId: payment.deviceId });
  const receivedHash = String(normalized?.hash || normalized?.HASH || '').trim();
  const hashOk = Boolean(receivedHash) && expectedHash.toLowerCase() === receivedHash.toLowerCase();

  const receivedAmount = Number(normalized?.txn_amt ?? normalized?.txnAmt ?? NaN);
  const amountOk = Number.isFinite(receivedAmount) ? receivedAmount === Number(payment.amountInr) : true;

  let verificationError: 'none' | 'hash_mismatch' | 'amount_mismatch' = 'none';
  if (!hashOk) verificationError = 'hash_mismatch';
  else if (!amountOk) verificationError = 'amount_mismatch';

  const incomplete = incompleteWorldlineVerificationPayload(normalized);
  const tpslEmpty = !String(normalized?.tpsl_txn_id || '').trim();
  let payloadError: string | null = null;
  if (incomplete) {
    payloadError = WORLDLINE_ERROR_INCOMPLETE_NORMALIZE;
  } else if (verificationError === 'hash_mismatch' && tpslEmpty) {
    payloadError = WORLDLINE_ERROR_HASH_MISMATCH_EMPTY_TPSL;
  }

  return {
    hashOk,
    amountOk,
    verificationError,
    receivedHash,
    normalized,
    payloadError,
    statusCode: String(normalized?.txn_status || normalized?.statusCode || '').trim(),
    statusMessage: String(normalized?.txn_msg || normalized?.txn_err_msg || ''),
  };
}
