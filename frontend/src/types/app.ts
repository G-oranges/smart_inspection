import type { Dispatch, SetStateAction } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ActiveTheme = 'light' | 'dark';
export type PermissionCode = string;

export interface GradingRule {
  label: string;
  min: number | null;
  max: number | null;
}

export interface DeductionItem {
  name: string;
  code: string;
  points: number;
  enabled: boolean;
  maxPoints?: number | string | null;
}

export interface AppSettings {
  gradingRules: GradingRule[];
  inspectionDefaultScore: number;
  studentContactEditable: boolean;
  contactEmailDomains: string[];
  deductionItems: DeductionItem[];
  locationOptions?: unknown[];
  [key: string]: unknown;
}

export interface AppActions extends Record<string, unknown> {
  changePassword?: (oldPassword: string, newPassword: string) => Promise<unknown>;
}

export interface AppSelectionState {
  count: number;
  title?: string;
  onClear: (() => void) | null;
  onAction: (() => void) | null;
  actionLabel: string;
}

export interface RoleLike {
  id?: string | number;
  code?: string;
  name?: string;
  typeCode?: string;
  typeName?: string;
  description?: string | null;
  isSystem?: boolean;
  sort?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface UserLike {
  id?: string | number;
  username?: string;
  fullName?: string;
  role?: string;
  roles?: RoleLike[];
  phone?: string;
  email?: string;
  avatarUrl?: string;
  isTemporaryPassword?: boolean;
  [key: string]: unknown;
}

export interface AppDataStore {
  dorms?: unknown[];
  users?: unknown[];
  tasks?: unknown[];
  inspections?: unknown[];
  myInspections?: unknown[];
  appeals?: unknown[];
  myAppeals?: unknown[];
  students?: unknown[];
  dormBeds?: unknown[];
  [key: string]: unknown;
}

export interface ThemePreset {
  key: string;
  label: string;
  emoji: string;
  value: string;
  darkValue?: string;
}

export interface ThemeCustomizationState {
  bgPreset: string;
  customBgUrl: string | null;
  selectPreset: (key: string) => void;
  setCustomBackground: (url: string | null) => void;
  resetToDefault: () => void;
  presets: ThemePreset[];
}

export interface AppContextValue {
  user: UserLike | null;
  data: AppDataStore;
  actions: AppActions;
  permissions: PermissionCode[];
  hasPermission: (code: string) => boolean;
  refresh: () => void;
  refreshUser: () => unknown | Promise<unknown>;
  onLogout: () => void | Promise<void>;
  settings: AppSettings | null;
  permissionsReady: boolean;
  myProfile: Record<string, unknown> | null;
  activeRole: RoleLike | null;
  setActiveRole: (role: RoleLike | null) => void;
  userRoles: RoleLike[] | null;
  themeMode: ThemeMode;
  activeTheme: ActiveTheme;
  setThemeMode: Dispatch<SetStateAction<ThemeMode>>;
  fontSizeScale: number;
  setFontSizeScale: Dispatch<SetStateAction<number>>;
  selection: AppSelectionState;
  setSelection: Dispatch<SetStateAction<AppSelectionState>>;
  themeCustomization: ThemeCustomizationState;
}
