import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';

import { normalizeSettings } from './adminSettingsSchema';

import type { DeductionItem } from '../../types/app';
import type {
  AdminSettingsDraft,
  UseAdminSettingsActionsProps,
  UseAdminSettingsActionsResult,
} from './types';

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function useAdminSettingsActions({
  settings,
  actions,
  location,
  navigate,
}: UseAdminSettingsActionsProps): UseAdminSettingsActionsResult {
  const normalizedSettings = useMemo(
    () => normalizeSettings(settings),
    [settings],
  );
  const [draft, setDraft] = useState<AdminSettingsDraft>(normalizedSettings);
  const [emailDomainDraft, setEmailDomainDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const lastPathRef = useRef(location.pathname + location.search);
  const suppressNavigationRef = useRef(false);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(normalizedSettings),
    [draft, normalizedSettings],
  );

  useEffect(() => {
    setDraft(normalizedSettings);
    setEmailDomainDraft('');
    setMessage('');
    setError('');
  }, [normalizedSettings]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return undefined;
      }

      event.preventDefault();
      event.returnValue = '您有未保存的修改，确定要离开吗？';
      return event.returnValue;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    if (suppressNavigationRef.current) {
      lastPathRef.current = currentPath;
      suppressNavigationRef.current = false;
      return;
    }
    if (!isDirty) {
      lastPathRef.current = currentPath;
      return;
    }
    if (currentPath !== lastPathRef.current) {
      const confirmLeave = window.confirm('您有未保存的修改，确认离开并丢弃更改吗？');
      if (!confirmLeave) {
        suppressNavigationRef.current = true;
        navigate(lastPathRef.current, { replace: true });
        return;
      }
      lastPathRef.current = currentPath;
    }
  }, [isDirty, location.pathname, location.search, navigate]);

  const handleSave = (): void => {
    Modal.confirm({
      title: '确认保存系统设置',
      content:
        '系统设置的修改将立即影响全校的评分规则、录入习惯及扣分项。确定要应用这些更改吗？',
      okText: '确认保存',
      cancelText: '取消',
      onOk: async () => {
        setSaving(true);
        setMessage('');
        setError('');
        try {
          await actions.updateSettings(draft);
          setMessage('设置已保存');
          suppressNavigationRef.current = true;
          lastPathRef.current = location.pathname + location.search;
        } catch (saveError) {
          setError(readErrorMessage(saveError, '保存失败'));
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleTemplateDownload = async (type: string): Promise<void> => {
    try {
      const blob = await actions.downloadTemplate(type);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}_template.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(readErrorMessage(downloadError, '模板下载失败'));
    }
  };

  const handleAddEmailDomain = (): void => {
    const rawValue = emailDomainDraft.trim().toLowerCase();
    const value = rawValue.replace(/^@/, '');
    if (!value) {
      return;
    }
    setDraft((prev) => {
      const current = Array.isArray(prev.contactEmailDomains)
        ? prev.contactEmailDomains
        : [];
      if (current.includes(value)) {
        return prev;
      }
      return { ...prev, contactEmailDomains: [...current, value] };
    });
    setEmailDomainDraft('');
  };

  const handleRemoveEmailDomain = (domain: string): void => {
    setDraft((prev) => ({
      ...prev,
      contactEmailDomains: prev.contactEmailDomains.filter((item) => item !== domain),
    }));
  };

  const handleRuleChange = (
    index: number,
    field: 'min' | 'max',
    value: number | string | null | undefined,
  ): void => {
    setDraft((prev) => {
      const copy = [...prev.gradingRules];
      copy[index] = {
        ...copy[index],
        [field]: value === '' ? null : Number(value),
      };
      return { ...prev, gradingRules: copy };
    });
  };

  const handleLabelChange = (index: number, label: string): void => {
    setDraft((prev) => {
      const copy = [...prev.gradingRules];
      copy[index] = { ...copy[index], label };
      return { ...prev, gradingRules: copy };
    });
  };

  const handleDeductionChange = (
    index: number,
    field: keyof DeductionItem | 'maxPoints',
    value: unknown,
  ): void => {
    setDraft((prev) => {
      const list = [...prev.deductionItems];
      list[index] = {
        ...list[index],
        [field]: field === 'points' ? Number(value || 0) : value,
      };
      return { ...prev, deductionItems: list };
    });
  };

  const handleDeductionToggle = (index: number, checked: boolean): void => {
    setDraft((prev) => {
      const list = [...prev.deductionItems];
      list[index] = { ...list[index], enabled: checked };
      return { ...prev, deductionItems: list };
    });
  };

  const handleAddDeduction = (): void => {
    setDraft((prev) => ({
      ...prev,
      deductionItems: [
        ...prev.deductionItems,
        {
          name: '新增扣分项',
          code: `CODE_${Date.now()}`,
          points: 1,
          enabled: true,
        },
      ],
    }));
  };

  const handleRemoveDeduction = (index: number): void => {
    setDraft((prev) => {
      const list = [...prev.deductionItems];
      list.splice(index, 1);
      return { ...prev, deductionItems: list };
    });
  };

  const handleAddLocation = (): void => {
    setDraft((prev) => ({
      ...prev,
      locationOptions: [...prev.locationOptions, `位置${prev.locationOptions.length + 1}`],
    }));
  };

  const handleRemoveLocation = (index: number): void => {
    setDraft((prev) => {
      const list = [...prev.locationOptions];
      list.splice(index, 1);
      return { ...prev, locationOptions: list };
    });
  };

  const handleLocationChange = (index: number, value: string): void => {
    setDraft((prev) => {
      const list = [...prev.locationOptions];
      list[index] = value;
      return { ...prev, locationOptions: list };
    });
  };

  return {
    draft,
    setDraft,
    emailDomainDraft,
    setEmailDomainDraft,
    saving,
    error,
    message,
    isDirty,
    handleSave,
    handleTemplateDownload,
    handleAddEmailDomain,
    handleRemoveEmailDomain,
    handleRuleChange,
    handleLabelChange,
    handleDeductionChange,
    handleDeductionToggle,
    handleAddDeduction,
    handleRemoveDeduction,
    handleAddLocation,
    handleRemoveLocation,
    handleLocationChange,
  };
}
