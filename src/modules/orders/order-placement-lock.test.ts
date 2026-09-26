import { releaseLocalSlot, resetLocalPlacementLocks, tryClaimLocalSlot } from './order-placement-lock';

describe('open order slots', () => {
  beforeEach(() => resetLocalPlacementLocks());

  it('allows up to 3 placements at the same time and rejects the 4th', () => {
    expect(tryClaimLocalSlot('user-1')).toBe(true);
    expect(tryClaimLocalSlot('user-1')).toBe(true);
    expect(tryClaimLocalSlot('user-1')).toBe(true);
    expect(tryClaimLocalSlot('user-1')).toBe(false);
  });

  it('allows the next order once the previous placement has finished', () => {
    expect(tryClaimLocalSlot('user-1')).toBe(true);
    releaseLocalSlot('user-1');
    expect(tryClaimLocalSlot('user-1')).toBe(true);
    releaseLocalSlot('user-1');
    expect(tryClaimLocalSlot('user-1')).toBe(true);
  });
});