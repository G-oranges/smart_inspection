/**
 * 通用用户头像组件
 * @module components/common/UserAvatar
 *
 * 封装头像显示逻辑：
 * - 如果用户有上传头像 (avatarUrl)，显示图片
 * - 否则显示首字蓝圆默认头像
 */
import React, { useEffect, useState } from "react";

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * @param {Object} props
 * @param {string} [props.avatarUrl] - 用户上传的头像 URL
 * @param {string} props.name - 用户名（用于提取首字）
 * @param {number|string} [props.size=40] - 头像尺寸 (px)
 * @param {string} [props.className] - 额外 CSS class
 * @param {Object} [props.style] - 额外行内样式
 */
export default function UserAvatar({
  avatarUrl,
  name = "",
  size = 40,
  className = "",
  style = {},
}: UserAvatarProps) {
  const initial = name?.charAt(0)?.toUpperCase() || "U";
  const sizeNum = typeof size === "string" ? parseInt(size, 10) : size;
  const fontSize = Math.max(12, Math.round(sizeNum * 0.4));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{
        width: sizeNum,
        height: sizeNum,
        minWidth: sizeNum,
        ...style,
      }}
    >
      <div
        className="w-full h-full rounded-full bg-gradient-to-br from-ios-blue/20 to-ios-indigo/20 flex items-center justify-center text-ios-blue font-black shadow-inner"
        style={{ fontSize }}
      >
        {initial}
      </div>
      {avatarUrl && !imgError && (
        <img
          src={avatarUrl}
          alt={`${name}的头像`}
          className="absolute inset-0 w-full h-full rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}
