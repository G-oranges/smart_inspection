/**
 * 读取数据范围可选项（全量学院/专业/班级与楼栋/楼层/房间）。
 * @module pages/account-permission/useScopeOptions
 */

import { useEffect, useState } from 'react';

import { commonService } from '../../services/commonService';
import type { ScopeOptionsResponse } from '../../types/service';

let cachedOptions: Promise<ScopeOptionsResponse> | null = null;

/** 读取数据范围可选项（页面内只请求一次）。 */
export function useScopeOptions(enabled = true) {
  const [options, setOptions] = useState<ScopeOptionsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let cancelled = false;
    cachedOptions = cachedOptions || commonService.getScopeOptions();
    cachedOptions
      .then((result) => {
        if (!cancelled) {
          setOptions(result);
        }
      })
      .catch((caught: unknown) => {
        cachedOptions = null;
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '加载可选学院与楼栋失败');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { options, error };
}
