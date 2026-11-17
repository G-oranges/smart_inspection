/**
 * 网络状态指示器组件
 * 
 * 功能：
 * 1. 检测网络在线/离线状态
 * 2. 离线时显示提示横幅
 * 3. 网络恢复时显示成功提示
 */

import { useEffect, useState } from 'react';
import { WifiOutlined, DisconnectOutlined } from '@ant-design/icons';

export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // 显示"已恢复连接"提示
      setShowReconnected(true);
      window.setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 在线且没有恢复提示时不显示任何内容
  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        background: isOnline 
          ? 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
          : 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        zIndex: 10001,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        animation: 'slideDown 0.3s ease-out',
        fontWeight: 500,
        fontSize: 14,
      }}
    >
      {isOnline ? (
        <>
          <WifiOutlined />
          <span>网络已恢复连接</span>
        </>
      ) : (
        <>
          <DisconnectOutlined />
          <span>您当前处于离线状态，部分功能可能受限</span>
        </>
      )}
      
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default NetworkStatusIndicator;
