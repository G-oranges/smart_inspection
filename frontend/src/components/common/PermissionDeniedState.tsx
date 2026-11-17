import type { ReactNode } from 'react';
import { Button } from 'antd';
import { CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';

import PageLayout from '../PageLayout';

type PermissionDeniedMode = 'page' | 'section';
type PermissionDeniedVariant = 'warning' | 'danger' | 'neutral' | 'dark';

interface PermissionDeniedStateProps {
  mode?: PermissionDeniedMode;
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  message?: ReactNode;
  actionText?: ReactNode;
  onAction?: () => void;
  icon?: ReactNode;
  variant?: PermissionDeniedVariant;
  className?: string;
}

const VARIANT_STYLES: Record<
  PermissionDeniedVariant,
  {
    badge: string;
    panel: string;
  }
> = {
  warning: {
    badge:
      'bg-amber-50 text-amber-500 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    panel:
      'border border-amber-100/80 bg-amber-50/55 dark:bg-amber-500/5 dark:border-amber-500/15',
  },
  danger: {
    badge:
      'bg-red-50 text-red-500 border border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
    panel:
      'border border-red-100/80 bg-red-50/55 dark:bg-red-500/5 dark:border-red-500/15',
  },
  neutral: {
    badge:
      'bg-black/[0.04] text-co-text border border-black/[0.06] dark:bg-white/[0.08] dark:text-white dark:border-white/[0.08]',
    panel:
      'border border-black/[0.06] bg-white/55 dark:bg-white/[0.04] dark:border-white/[0.08]',
  },
  dark: {
    badge:
      'bg-black/10 text-white border border-white/10 dark:bg-white/10 dark:text-white dark:border-white/10',
    panel:
      'border border-white/10 bg-black/35 dark:bg-black/30 dark:border-white/10',
  },
};

function resolveDefaultIcon(variant: PermissionDeniedVariant) {
  if (variant === 'danger' || variant === 'dark') {
    return <CloseCircleOutlined className="text-[28px]" />;
  }

  return <WarningOutlined className="text-[28px]" />;
}

export default function PermissionDeniedState({
  mode = 'page',
  eyebrow = '权限不足',
  title = '访问受限',
  subtitle,
  message,
  actionText,
  onAction,
  icon,
  variant = 'warning',
  className = '',
}: PermissionDeniedStateProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const resolvedIcon = icon ?? resolveDefaultIcon(variant);

  const content = (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        mode === 'page'
          ? 'min-h-[280px] rounded-[28px] px-6 py-12'
          : `rounded-[20px] px-6 py-8 backdrop-blur-xl ${variantStyle.panel}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'mb-5 flex h-16 w-16 items-center justify-center rounded-full',
          variantStyle.badge,
        ].join(' ')}
      >
        {resolvedIcon}
      </div>
      {message ? (
        <p className="max-w-xl text-sm font-medium leading-6 text-black/60 dark:text-white/65">
          {message}
        </p>
      ) : null}
      {actionText && onAction ? (
        <Button
          type="primary"
          size="large"
          onClick={onAction}
          className="apple-btn-primary mt-6 h-11 rounded-xl px-8 font-bold"
        >
          {actionText}
        </Button>
      ) : null}
    </div>
  );

  if (mode === 'section') {
    return content;
  }

  return (
    <PageLayout eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="mx-auto max-w-2xl">{content}</div>
    </PageLayout>
  );
}
