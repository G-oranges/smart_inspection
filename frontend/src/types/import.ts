export type ImportStrategy = 'SKIP' | 'OVERWRITE';

export interface ImportFieldConfig {
  key: string;
  label: string;
  required?: boolean;
  type?: string;
  description?: string;
  min?: number;
  max?: number;
  enum?: string[];
  validation?: {
    pattern?: string;
    message?: string;
    [key: string]: unknown;
  };
}

export interface ImportTemplateConfig {
  emptyTemplateName?: string;
  sampleTemplateName?: string;
  sheetName?: string;
  downloadUrl?: string;
  sampleRow?: Record<string, unknown>;
}

export interface ImportApiConfig {
  preview: string;
  execute: string;
}

export interface ImportLimitsConfig {
  maxFileSize?: number;
  maxRows?: number;
}

export interface ImportWizardConfig {
  mode: string;
  title: string;
  template?: ImportTemplateConfig;
  fields: ImportFieldConfig[];
  requiredFields: string[];
  codeFields?: string[];
  uniqueKeys?: string[];
  uniqueKeyDescription?: string;
  normalizers?: Record<string, Record<string, unknown>>;
  strategies?: string[];
  strategyDescriptions?: Partial<Record<string, string>>;
  api: ImportApiConfig;
  limits?: ImportLimitsConfig;
  notes?: string[];
}

export interface ImportWizardModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  config: ImportWizardConfig;
}
