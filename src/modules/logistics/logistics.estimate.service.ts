import { LogisticsProviderConfig } from './logistics.models';
import { ensureDefaultConfigs } from './logistics.provider-config.service';
import { createPorterAdapter, type EstimatePayload } from './porter.adapter';
import { logger } from '../../utils/logger';

export interface EstimateResult {
  provider: string;
  ok: boolean;
  fare?: number;
  distanceKm?: number;
  raw?: unknown;
  error?: string;
}

export interface MultiEstimateBody extends EstimatePayload {
  providers?: Array<'PORTER' | 'SHADOWFAX' | 'LOADSHARE'>;
}

function getProviderAdapterForEstimate(name: string) {
  // Currently only Porter is implemented. Extend here for additional providers.
  if (name === 'PORTER') return createPorterAdapter();
  logger.warn(`[estimate] no adapter for provider "${name}", skipping`);
  return null;
}

/**
 * Calls getFareEstimate on all active (and optionally filtered) providers
 * and returns a consolidated list of results — failures are captured, not thrown.
 */
export async function multiEstimate(body: MultiEstimateBody): Promise<{ results: EstimateResult[] }> {
  await ensureDefaultConfigs();

  const requested = body.providers;
  let configRows = await LogisticsProviderConfig.find({ isActive: true })
    .sort({ priority: 1 })
    .select('name')
    .lean();

  let names = configRows.map((n) => n.name);
  if (requested && requested.length) {
    names = names.filter((n) => requested.includes(n as 'PORTER' | 'SHADOWFAX' | 'LOADSHARE'));
  }

  const results: EstimateResult[] = [];

  for (const name of names) {
    const adapter = getProviderAdapterForEstimate(name);
    if (!adapter) {
      results.push({ provider: name, ok: false, error: 'No adapter available' });
      continue;
    }

    try {
      const est = await adapter.getFareEstimate(body);
      results.push({
        provider: name,
        ok: true,
        fare: est.fare,
        distanceKm: est.distanceKm,
        raw: est.raw,
      });
    } catch (e) {
      logger.warn('[estimate] provider failed', { name, error: (e as Error).message });
      results.push({ provider: name, ok: false, error: (e as Error).message });
    }
  }

  return { results };
}
