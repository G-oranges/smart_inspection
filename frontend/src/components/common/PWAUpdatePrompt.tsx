import { useEffect, useState } from 'react';
import { Button, Modal, Typography } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';

import { isServiceWorkerSupported } from './pwa';
import { MODAL_WIDTH } from "./modalSizes";

const { Text } = Typography;

export default function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    if (!isServiceWorkerSupported) {
      return;
    }

    if (window.__pwa_registered) {
      return;
    }

    window.__pwa_registered = true;

    void import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            setNeedRefresh(true);
          },
          onOfflineReady() {
            setOfflineReady(true);
            window.setTimeout(() => setOfflineReady(false), 3000);
          },
          onRegistered(registration: ServiceWorkerRegistration | undefined) {
            console.log('[PWA] Service Worker 注册成功');
            if (registration) {
              window.setInterval(() => {
                void registration.update();
              }, 60 * 60 * 1000);
            }
          },
          onRegisterError(error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') {
              console.warn('[PWA] Service Worker 注册被取消 (AbortError)，这通常发生在开发环境热更新时。');
              return;
            }

            console.error('[PWA] Service Worker 注册失败:', error);
          },
        });

        window.__pwaUpdateSW = updateSW;
      })
      .catch((error) => {
        console.warn('[PWA] 无法加载 PWA 注册模块:', error);
        window.__pwa_registered = false;
      });
  }, []);

  const handleUpdate = () => {
    void window.__pwaUpdateSW?.(true);
    setNeedRefresh(false);
  };

  const handleClose = () => {
    setNeedRefresh(false);
  };

  return (
    <>
      {offlineReady ? (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
            color: 'white',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(82, 196, 26, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 10000,
            animation: 'slideUp 0.3s ease-out',
          }}
        >
          <CloudDownloadOutlined style={{ fontSize: 20 }} />
          <Text style={{ color: 'white', fontWeight: 500 }}>应用已准备好离线使用</Text>
        </div>
      ) : null}

      <Modal
        open={needRefresh}
        title="发现新版本"
        footer={[
          <Button key="later" onClick={handleClose}>稍后再说</Button>,
          <Button key="update" type="primary" onClick={handleUpdate}>
            立即更新
          </Button>,
        ]}
        onCancel={handleClose}
        centered
        width={MODAL_WIDTH.sm}
        className="co-modal"
        maskClosable={false}
      >
        <Text>更新将刷新页面，请先保存当前工作。</Text>
      </Modal>
    </>
  );
}
