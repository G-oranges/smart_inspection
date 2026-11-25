import { useEffect, useState } from 'react';
import { Image } from 'antd';
import type { ImageProps } from 'antd';

import { appealService } from '../../services/appealService';
import { resolvePhotoUrl } from '../../utils/url';

export interface AuthPhotoImageProps extends Omit<ImageProps, 'src'> {
  src: string;
}

function isProtectedAppealPhoto(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/api/appeals/') ||
    trimmed.includes('/api/appeals/')
  );
}

export default function AuthPhotoImage({
  src,
  alt = '证据照片',
  ...imageProps
}: AuthPhotoImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string>(() =>
    isProtectedAppealPhoto(src) ? '' : resolvePhotoUrl(src),
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setResolvedSrc('');
      return;
    }

    if (!isProtectedAppealPhoto(src)) {
      setLoadFailed(false);
      setResolvedSrc(resolvePhotoUrl(src));
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    setLoadFailed(false);

    appealService
      .fetchAppealPhotoBlob(src, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (loadFailed) {
    return (
      <div
        className="flex items-center justify-center text-xs rounded-lg"
        style={{
          width: imageProps.width ?? 96,
          height: imageProps.height ?? 96,
          border: '1px solid var(--co-glass-border)',
          background: 'var(--co-input-bg)',
          color: 'var(--co-text-muted)',
        }}
      >
        加载失败
      </div>
    );
  }

  if (!resolvedSrc) {
    return (
      <div
        className="animate-pulse rounded-lg"
        style={{
          width: imageProps.width ?? 96,
          height: imageProps.height ?? 96,
          border: '1px solid var(--co-glass-border)',
          background: 'var(--co-input-bg)',
        }}
      />
    );
  }

  return <Image {...imageProps} src={resolvedSrc} alt={alt} />;
}
