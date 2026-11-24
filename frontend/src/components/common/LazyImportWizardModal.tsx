import { lazy, Suspense, type ComponentType } from 'react';
import { Modal, Spin } from 'antd';

import type { ImportWizardModalProps } from '../../types/import';
import { loadImportWizardModal } from './importWizardPrefetch';
import { MODAL_WIDTH } from "./modalSizes";

const ImportWizardModal = lazy(loadImportWizardModal) as ComponentType<ImportWizardModalProps>;

function ImportWizardFallback({ open, onClose }: Pick<ImportWizardModalProps, 'open' | 'onClose'>) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      centered
      width={MODAL_WIDTH.sm}
      className="co-modal"
    >
      <div className="flex min-h-[180px] items-center justify-center">
        <Spin size="large" tip="正在加载…" />
      </div>
    </Modal>
  );
}

export default function LazyImportWizardModal(props: ImportWizardModalProps) {
  if (!props.open) {
    return null;
  }

  return (
    <Suspense
      fallback={<ImportWizardFallback open={props.open} onClose={props.onClose} />}
    >
      <ImportWizardModal {...props} />
    </Suspense>
  );
}
