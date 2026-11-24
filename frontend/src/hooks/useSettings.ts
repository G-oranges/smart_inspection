import { useCallback, useState } from 'react';

import { commonService } from '../services/commonService';
import { tokenManager } from '../utils/api';

import type { AppSettings } from '../types/app';

const DEFAULT_SETTINGS: AppSettings = {
  gradingRules: [
    { label: '不合格', min: null, max: 60 },
    { label: '合格', min: 60, max: 75 },
    { label: '良好', min: 75, max: 90 },
    { label: '优秀', min: 90, max: null },
  ],
  inspectionDefaultScore: 100,
  studentContactEditable: false,
  contactEmailDomains: [],
  deductionItems: [
    { name: '垃圾未倒', code: 'A', points: 2, enabled: true },
    { name: '桌面杂乱', code: 'B', points: 3, enabled: true },
    { name: '违规电器', code: 'C', points: 10, enabled: true },
  ],
  locationOptions: [],
};

function normalizeSettings(settings?: Partial<AppSettings> | null): AppSettings {
  if (!settings) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    gradingRules: Array.isArray(settings.gradingRules)
      ? settings.gradingRules
      : DEFAULT_SETTINGS.gradingRules,
    contactEmailDomains: Array.isArray(settings.contactEmailDomains)
      ? settings.contactEmailDomains
      : DEFAULT_SETTINGS.contactEmailDomains,
    deductionItems: Array.isArray(settings.deductionItems)
      ? settings.deductionItems
      : DEFAULT_SETTINGS.deductionItems,
    locationOptions: Array.isArray(settings.locationOptions)
      ? settings.locationOptions
      : DEFAULT_SETTINGS.locationOptions,
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const fetchSettings = useCallback(async (): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }

    try {
      const data = await commonService.getSettings();
      setSettings(normalizeSettings(data.settings));
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  const updateSettings = useCallback(
    async (payload: AppSettings): Promise<void> => {
      const data = await commonService.updateSettings(payload);
      setSettings(normalizeSettings(data.settings));
    },
    [],
  );

  return {
    settings,
    fetchSettings,
    updateSettings,
  };
}
