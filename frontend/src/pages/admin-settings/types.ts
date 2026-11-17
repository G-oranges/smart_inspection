import type { Dispatch, SetStateAction } from 'react';
import type { Location, NavigateFunction } from 'react-router-dom';

import type { AppSettings, DeductionItem, GradingRule } from '../../types/app';

export interface AdminSettingsDraft extends AppSettings {
  gradingRules: GradingRule[];
  deductionItems: DeductionItem[];
  locationOptions: string[];
  contactEmailDomains: string[];
}

export interface TemplateOption {
  type: string;
  label: string;
}

export interface AdminSettingsActions {
  updateSettings: (payload: AdminSettingsDraft) => Promise<unknown>;
  downloadTemplate: (type: string) => Promise<Blob>;
}

export interface UseAdminSettingsActionsProps {
  settings: AppSettings | null;
  actions: AdminSettingsActions;
  location: Location;
  navigate: NavigateFunction;
}

export interface UseAdminSettingsActionsResult {
  draft: AdminSettingsDraft;
  setDraft: Dispatch<SetStateAction<AdminSettingsDraft>>;
  emailDomainDraft: string;
  setEmailDomainDraft: Dispatch<SetStateAction<string>>;
  saving: boolean;
  error: string;
  message: string;
  isDirty: boolean;
  handleSave: () => void;
  handleTemplateDownload: (type: string) => Promise<void>;
  handleAddEmailDomain: () => void;
  handleRemoveEmailDomain: (domain: string) => void;
  handleRuleChange: (
    index: number,
    field: 'min' | 'max',
    value: number | string | null | undefined,
  ) => void;
  handleLabelChange: (index: number, label: string) => void;
  handleDeductionChange: (
    index: number,
    field: keyof DeductionItem | 'maxPoints',
    value: unknown,
  ) => void;
  handleDeductionToggle: (index: number, checked: boolean) => void;
  handleAddDeduction: () => void;
  handleRemoveDeduction: (index: number) => void;
  handleAddLocation: () => void;
  handleRemoveLocation: (index: number) => void;
  handleLocationChange: (index: number, value: string) => void;
}
