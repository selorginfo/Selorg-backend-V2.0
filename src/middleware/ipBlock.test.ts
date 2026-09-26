import { blockDurationMs, evaluateIpBlock, isGuardedAppPath, resetIpBlocks } from './ipBlock';

const OPTS = {
  windowMs: 60_000,
  maxRequests: 3,
  minBlockMs: 15 * 60 * 1000,
  maxBlockMs: 20 * 60 * 1000,
};

describe('ip block', () => {
  beforeEach(() => resetIpBlocks());

  it('covers customer, web, admin, rider, picker, and HSD routes', () => {
    expect(isGuardedAppPath('/api/v1/customer/orders')).toBe(true);
    expect(isGuardedAppPath('/api/v1/admin/orders')).toBe(true);
    expect(isGuardedAppPath('/api/v1/rider/orders')).toBe(true);
    expect(isGuardedAppPath('/api/v1/picker/tasks')).toBe(true);
    expect(isGuardedAppPath('/api/v1/hhd/orders')).toBe(true);
    expect(isGuardedAppPath('/api/v1/darkstore/inventory')).toBe(true);
    expect(isGuardedAppPath('/health')).toBe(false);
  });

  it('blocks the IP for 15 to 20 minutes after the burst', () => {
    const now = 1_000_000;
    expect(evaluateIpBlock('203.0.113.8', now, OPTS).blocked).toBe(false);
    expect(evaluateIpBlock('203.0.113.8', now + 1, OPTS).blocked).toBe(false);
    expect(evaluateIpBlock('203.0.113.8', now + 2, OPTS).blocked).toBe(false);

    const blocked = evaluateIpBlock('203.0.113.8', now + 3, OPTS, () => 0);
    expect(blocked.blocked).toBe(true);
    expect(blocked.justBlocked).toBe(true);
    expect(blocked.retryAfterSec).toBe(15 * 60);

    const still = evaluateIpBlock('203.0.113.8', now + 3 + 10 * 60 * 1000, OPTS);
    expect(still.blocked).toBe(true);
    expect(still.justBlocked).toBe(false);

    const later = evaluateIpBlock('203.0.113.8', now + 3 + 15 * 60 * 1000, OPTS);
    expect(later.blocked).toBe(false);
  });

  it('picks a duration inside 15 to 20 minutes', () => {
    expect(blockDurationMs(OPTS.minBlockMs, OPTS.maxBlockMs, () => 0)).toBe(15 * 60 * 1000);
    expect(blockDurationMs(OPTS.minBlockMs, OPTS.maxBlockMs, () => 0.999999)).toBe(20 * 60 * 1000);
  });

  it('does not block a different IP', () => {
    const now = 5_000;
    for (let i = 0; i < 4; i += 1) evaluateIpBlock('203.0.113.9', now, OPTS);
    expect(evaluateIpBlock('203.0.113.10', now, OPTS).blocked).toBe(false);
  });
});
