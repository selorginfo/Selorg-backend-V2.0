import { AppError } from '../../utils/AppError';
import { SystemConfig } from './system-config.model';

const APP_SETTINGS_KEY = 'dashboard_app_settings';

interface AppSettings {
  refreshIntervals: Record<string, number>;
  storeMode: 'online' | 'pause' | 'maintenance';
  notifications: { enabled: boolean; sound: boolean; criticalOnly: boolean; email: boolean };
  display: { theme: string; timeFormat: string; dateFormat: string };
  performance: { enableRealTimeUpdates: boolean; enableOptimisticUpdates: boolean; cacheTimeout: number };
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  refreshIntervals: {
    dashboard: 30,
    alerts: 15,
    orders: 10,
    inventory: 20,
    analytics: 30,
  },
  storeMode: 'online',
  notifications: {
    enabled: true,
    sound: true,
    criticalOnly: false,
    email: false,
  },
  display: {
    theme: 'light',
    timeFormat: '24h',
    dateFormat: 'MM/DD/YYYY',
  },
  performance: {
    enableRealTimeUpdates: true,
    enableOptimisticUpdates: true,
    cacheTimeout: 60,
  },
};

export function mergeAppSettings(value: unknown): AppSettings {
  const src = (value && typeof value === 'object' ? value : {}) as Partial<AppSettings> & {
    storeMode?: string;
  };
  return {
    refreshIntervals: {
      ...DEFAULT_APP_SETTINGS.refreshIntervals,
      ...(src.refreshIntervals || {}),
    },
    storeMode: (['online', 'pause', 'maintenance'].includes(src.storeMode || '')
      ? src.storeMode
      : DEFAULT_APP_SETTINGS.storeMode) as AppSettings['storeMode'],
    notifications: {
      ...DEFAULT_APP_SETTINGS.notifications,
      ...(src.notifications || {}),
    },
    display: {
      ...DEFAULT_APP_SETTINGS.display,
      ...(src.display || {}),
    },
    performance: {
      ...DEFAULT_APP_SETTINGS.performance,
      ...(src.performance || {}),
    },
  };
}

function validateSettings(settings: Partial<AppSettings>): void {
  if (settings.refreshIntervals) {
    for (const [key, value] of Object.entries(settings.refreshIntervals)) {
      if (typeof value !== 'number' || value < 5 || value > 300) {
        throw AppError.badRequest(`Invalid refresh interval for ${key}. Must be between 5 and 300 seconds.`);
      }
    }
  }
  if (settings.storeMode && !['online', 'pause', 'maintenance'].includes(settings.storeMode)) {
    throw AppError.badRequest('Invalid store mode. Must be online, pause, or maintenance.');
  }
}

export async function getAppSettings(): Promise<{ settings: AppSettings; lastUpdated: Date | null }> {
  const doc = await SystemConfig.findOne({ key: APP_SETTINGS_KEY }).lean();
  return { settings: mergeAppSettings(doc?.value), lastUpdated: doc?.updatedAt || null };
}

export async function updateAppSettings(
  incoming: Partial<AppSettings>,
  updatedBy: string,
): Promise<{ settings: AppSettings; lastUpdated: Date }> {
  if (!incoming || typeof incoming !== 'object') {
    throw AppError.badRequest('Settings object is required');
  }

  validateSettings(incoming);
  const currentDoc = await SystemConfig.findOne({ key: APP_SETTINGS_KEY }).lean();
  const merged = mergeAppSettings({ ...(currentDoc?.value as object | undefined), ...incoming });

  const doc = await SystemConfig.findOneAndUpdate(
    { key: APP_SETTINGS_KEY },
    { $set: { key: APP_SETTINGS_KEY, value: merged, updatedBy } },
    { new: true, upsert: true },
  );

  return { settings: mergeAppSettings(doc.value), lastUpdated: doc.updatedAt };
}
