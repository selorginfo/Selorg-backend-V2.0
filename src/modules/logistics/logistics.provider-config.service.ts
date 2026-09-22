import { LogisticsProviderConfig } from './logistics.models';
import { encryptCredentialsIfKeyPresent } from './logistics.crypto';
import { logger } from '../../utils/logger';

/**
 * Seeds two default provider configs (PORTER active, SHADOWFAX inactive)
 * if the collection is empty. Idempotent.
 */
export async function ensureDefaultConfigs(): Promise<void> {
  const n = await LogisticsProviderConfig.estimatedDocumentCount();
  if (n > 0) return;

  try {
    await LogisticsProviderConfig.insertMany([
      {
        name: 'PORTER',
        isActive: true,
        priority: 10,
        apiBaseUrl: process.env.PORTER_API_BASE_URL || 'https://api.porter.in',
        credentialsEncrypted: '',
        vehicleTypeMapping: new Map([['default', 'mini_truck']]),
      },
      {
        name: 'SHADOWFAX',
        isActive: false,
        priority: 20,
        apiBaseUrl: 'https://api.shadowfax.in',
        credentialsEncrypted: '',
        vehicleTypeMapping: new Map(),
      },
    ]);
    logger.info('[logistics] seeded default LogisticsProviderConfig');
  } catch (err) {
    logger.warn('[logistics] seed configs skipped', { error: (err as Error).message });
  }
}

/** Returns all provider configs sorted by priority. */
export async function listConfigs() {
  await ensureDefaultConfigs();
  return LogisticsProviderConfig.find().sort({ priority: 1 }).lean();
}

/** Applies a partial patch to a provider config and returns the updated doc. */
export async function updateConfig(id: string, patch: Partial<{ isActive: boolean; priority: number }>) {
  return LogisticsProviderConfig.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
}

/**
 * Swaps the priority values of the target config with its neighbour in the
 * sorted list, effectively moving it "up" (lower priority number) or "down".
 */
export async function reorderConfig(id: string, direction: 'up' | 'down') {
  const configs = await LogisticsProviderConfig.find().sort({ priority: 1, name: 1 }).lean();
  const idx = configs.findIndex((c) => String(c._id) === String(id));
  if (idx < 0) return null;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= configs.length) {
    return listConfigs();
  }

  const current = configs[idx];
  const adjacent = configs[swapIdx];

  await LogisticsProviderConfig.findByIdAndUpdate(current._id, {
    $set: { priority: adjacent.priority },
  });
  await LogisticsProviderConfig.findByIdAndUpdate(adjacent._id, {
    $set: { priority: current.priority },
  });

  return listConfigs();
}

export { encryptCredentialsIfKeyPresent };
