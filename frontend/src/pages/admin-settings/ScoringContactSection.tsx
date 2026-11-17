import { Row, Col, Typography, Input, InputNumber, Switch, Tag, Button } from "antd";

import type { Dispatch, SetStateAction } from 'react';

import type { AdminSettingsDraft } from './types';

const { Text } = Typography;

interface ScoringContactSectionProps {
  draft: AdminSettingsDraft;
  setDraft: Dispatch<SetStateAction<AdminSettingsDraft>>;
  emailDomainDraft: string;
  setEmailDomainDraft: Dispatch<SetStateAction<string>>;
  handleAddEmailDomain: () => void;
  handleRemoveEmailDomain: (domain: string) => void;
}

export const ScoringContactSection = ({
  draft,
  setDraft,
  emailDomainDraft,
  setEmailDomainDraft,
  handleAddEmailDomain,
  handleRemoveEmailDomain
}: ScoringContactSectionProps) => {
  const contactEmailDomains = Array.isArray(draft.contactEmailDomains) ? draft.contactEmailDomains : [];

  return (
    <div className="space-y-6">
      <Row gutter={24} align="middle">
        <Col span={10}>
          <div className="flex flex-col gap-1">
            <Text className="text-[13px] font-medium">录入页默认分数</Text>
            <Text type="secondary" className="text-[11px] mb-2 opacity-60">
              设置打分录入时的初始评分基准
            </Text>
          </div>
        </Col>
        <Col span={14}>
          <InputNumber
            style={{ width: '120px' }}
            min={0} max={100}
            suffix="分"
            value={draft.inspectionDefaultScore ?? 100}
            onChange={(val) =>
              setDraft((prev) => ({
                ...prev,
                inspectionDefaultScore: Number(val || 0),
              }))
            }
            className="apple-input-number h-10 leading-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
          />
        </Col>
      </Row>

      <div className="h-[1px] bg-black/5 dark:bg-white/5" />

      <Row gutter={24} align="middle">
        <Col span={10}>
          <div className="flex flex-col gap-1">
            <Text className="text-[13px] font-medium">联系方式修改权限</Text>
            <Text type="secondary" className="text-[11px] mb-2 opacity-60">
              控制账号详情页内联系方式是否允许用户自编辑
            </Text>
          </div>
        </Col>
        <Col span={14}>
          <div className="flex items-center gap-3">
             <Switch
                checked={Boolean(draft.studentContactEditable)}
                className="apple-switch"
                onChange={(checked) =>
                  setDraft((prev) => ({
                    ...prev,
                    studentContactEditable: checked,
                  }))
                }
              />
              <Text className="text-[12px]">{draft.studentContactEditable ? '已允许修改' : '禁止修改'}</Text>
          </div>
        </Col>
      </Row>

      <div className="h-[1px] bg-black/5 dark:bg-white/5" />

      <div>
        <div className="flex flex-col gap-1 mb-4">
          <Text className="text-[13px] font-medium">可用邮箱域名</Text>
          <Text type="secondary" className="text-[11px] opacity-60">
            限制用户录入的邮箱后缀（如 school.edu），防止录入错误
          </Text>
        </div>
        
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Input
              value={emailDomainDraft}
              onChange={(event) => setEmailDomainDraft(event.target.value)}
              onPressEnter={handleAddEmailDomain}
              placeholder="输入新域名，如 @school.edu"
              className="apple-search-input h-10 !bg-gray-100/50 dark:!bg-white/5 border-none flex-1"
            />
            <Button
              className="apple-btn-secondary admin-settings-email-domain-action h-10 px-6 border-transparent bg-gray-200 dark:bg-white/10 shrink-0"
              disabled={!emailDomainDraft.trim()}
              onClick={handleAddEmailDomain}
            >
              添加
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {contactEmailDomains.map((domain) => (
              <Tag
                key={domain}
                closable
                onClose={() => handleRemoveEmailDomain(domain)}
                className="px-3 py-1 rounded-full border-none bg-primary/10 text-primary font-medium m-0"
              >
                {domain}
              </Tag>
            ))}
            {contactEmailDomains.length === 0 && (
              <div className="px-4 py-3 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200/20 rounded-xl">
                <Text type="warning" className="text-[11px]">
                  ⚠️ 未配置可用域名时，邮箱编辑功能将自动锁定。
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
