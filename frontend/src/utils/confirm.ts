/**
 * 危险操作倒计时强确认工具
 * @module utils/confirm
 * @description 提供带倒计时的二阶段强确认弹窗，适用于删除类危险操作。
 *   参见 doc/confirm_policy.md § 4.4
 */

import { Modal } from "antd";
import type { ReactNode } from 'react';
import type { ModalFuncProps } from 'antd';

interface ConfirmDangerCountdownOptions extends Omit<ModalFuncProps, 'okType' | 'maskClosable' | 'keyboard' | 'onOk' | 'onCancel' | 'afterClose'> {
  title?: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  seconds?: number;
}

/**
 * 倒计时强确认弹窗
 *
 * 使用 Modal.confirm + N 秒倒计时（默认 5 秒），倒计时内确认按钮禁用。
 *
 * @param {Object}           options
 * @param {string}           options.title       - 弹窗标题
 * @param {React.ReactNode}  options.content     - 弹窗内容
 * @param {string}           [options.okText="是否确认"] - 确认按钮文字
 * @param {string}           [options.cancelText="取消"] - 取消按钮文字
 * @param {number}           [options.seconds=5] - 倒计时秒数
 * @param {Object}           [options.rest]      - 其他 Modal.confirm 配置（不可覆盖 okType/maskClosable/keyboard）
 * @returns {Promise<boolean>} 用户确认返回 true，取消或关闭返回 false
 */
export async function confirmDangerCountdown({
  title,
  content,
  okText = "是否确认",
  cancelText = "取消",
  seconds = 5,
  ...rest
}: ConfirmDangerCountdownOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let remaining = seconds;
    let timer: ReturnType<typeof setInterval> | null = null;
    let settled = false; // 保证 resolve 只执行一次

    // 清理定时器的统一入口（幂等），防止泄漏
    const cleanup = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    // 安全 resolve：确保 onOk/onCancel/afterClose 多次触发时只 resolve 一次
    const safeResolve = (value: boolean) => {
      cleanup();
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const modal = Modal.confirm({
      ...rest,
      title,
      content,
      cancelText,
      okText: `${okText} (${remaining})`,
      okButtonProps: { disabled: true },
      // 以下四项为策略固定值，放在 ...rest 之后确保不被外部覆盖
      okType: "danger",
      maskClosable: false,
      keyboard: false,
      afterClose: () => {
        // 兜底：无论通过何种方式关闭，都清理 timer 并 resolve(false)
        cleanup();
        if (!settled) {
          settled = true;
          resolve(false);
        }
      },
      onOk: () => safeResolve(true),
      onCancel: () => safeResolve(false),
    });

    timer = setInterval(() => {
      // settled 后不再 update，避免操作已销毁的 modal
      if (settled) {
        cleanup();
        return;
      }
      remaining -= 1;
      if (remaining > 0) {
        modal.update({
          okText: `${okText} (${remaining})`,
          okButtonProps: { disabled: true },
        });
      } else {
        cleanup();
        modal.update({
          okText,
          okButtonProps: { disabled: false },
        });
      }
    }, 1000);
  });
}
