import { useState } from "react";
import { Form, Input, Button, Steps, App } from "antd";
import {
  UserOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  LockOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  SunOutlined,
  MoonOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { authService } from "../services/authService";
import type { FormRule } from "antd";
import type { FormEvent } from "react";
import type { ThemeMode } from "../types/app";

interface ForgotPasswordFormProps {
  onBack: () => void;
  theme?: ThemeMode;
  toggleTheme?: () => void;
}

interface UsernameFormValues {
  username: string;
}

interface EmailFormValues {
  email: string;
}

interface ResetPasswordFormValues {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

interface ServiceError {
  message?: string;
}

/**
 * 忘记密码表单组件 - Apple HIG 深度定制版
 */
export default function ForgotPasswordForm({
  onBack,
  theme,
  toggleTheme,
}: ForgotPasswordFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [usernameForm] = Form.useForm<UsernameFormValues>();
  const [emailForm] = Form.useForm<EmailFormValues>();
  const [resetForm] = Form.useForm<ResetPasswordFormValues>();
  
  const { message: antMessage } = App.useApp();

  // 倒计时间逻辑
  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCheckUsername = async (values: UsernameFormValues) => {
    setLoading(true);
    try {
      const result = await authService.checkUserEmail(values.username);
      setUsername(values.username);
      setMaskedEmail(result.maskedEmail ?? "");
      setCurrentStep(1);
    } catch (err) {
      antMessage.error((err as ServiceError).message || "用户名验证失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (values: EmailFormValues) => {
    setLoading(true);
    try {
      await authService.forgotPassword(username, values.email);
      setEmail(values.email);
      antMessage.success("验证码已发送到你的邮箱");
      setCurrentStep(2);
      startCountdown();
    } catch (err) {
      antMessage.error((err as ServiceError).message || "发送验证码失败");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await authService.forgotPassword(username, email);
      antMessage.success("验证码已重新发送");
      startCountdown();
    } catch (err) {
      antMessage.error((err as ServiceError).message || "发送验证码失败");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values: ResetPasswordFormValues) => {
    setLoading(true);
    try {
      await authService.resetPassword(email, values.code, values.newPassword);
      setCurrentStep(3);
    } catch (err) {
      antMessage.error((err as ServiceError).message || "密码重置失败");
    } finally {
      setLoading(false);
    }
  };

  const passwordRules: FormRule[] = [
    { required: true, message: "请输入新密码" },
    { min: 8, message: "密码不少于 8 位" },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/,
      message: "需包含大小写字母、数字和符号",
    },
  ];

  const steps = [
    { title: "身份确认" },
    { title: "邮箱验证" },
    { title: "重置密码" },
    { title: "完成" },
  ];

  const handleGoBack = () => {
    if (currentStep === 0) {
      onBack();
    } else if (currentStep === 1) {
      setCurrentStep(0);
      setMaskedEmail("");
      setUsername("");
    } else if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  return (
    <div className="glass-panel w-full max-auto p-8 rounded-[32px] overflow-hidden animate-apple-in" style={{ maxWidth: '440px' }}>
      {/* 顶部栏 */}
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={handleGoBack}
          className="flex items-center gap-1.5 text-ios-blue font-bold text-sm active-press"
        >
          <ArrowLeftOutlined className="text-xs" />
          {currentStep === 0 ? "返回登录" : "上一步"}
        </button>
        
        <div className="bg-ios-gray/50 dark:bg-white/10 p-1 rounded-full flex items-center gap-2">
          <SunOutlined className={`text-xs px-2 py-1 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow-sm text-ios-orange' : 'text-ios-gray-label'}`} onClick={theme === 'dark' ? toggleTheme : undefined} />
          <MoonOutlined className={`text-xs px-2 py-1 rounded-full transition-all ${theme === 'dark' ? 'bg-[#636366] shadow-sm text-ios-yellow' : 'text-ios-gray-label'}`} onClick={theme === 'light' ? toggleTheme : undefined} />
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-[24px] font-black tracking-tight text-black dark:text-white mb-2">
          找回密码
        </h1>
      </div>

      <Steps
        current={currentStep}
        items={steps}
        size="small"
        direction="horizontal"
        className="apple-steps apple-steps-horizontal mb-5"
      />

      {/* 步骤0: 输入用户名 */}
      {currentStep === 0 && (
        <Form form={usernameForm} layout="vertical" onFinish={handleCheckUsername} className="apple-form">
          <Form.Item
            name="username"
            rules={[{ required: true, message: "请输入登录用户名" }]}
          >
            <Input
              prefix={<UserOutlined className="text-ios-gray-label" />}
              placeholder="输入登录用户名"
              className="apple-input h-14"
            />
          </Form.Item>
          <Form.Item className="mt-8">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="h-14 rounded-2xl text-[17px] font-black bg-ios-blue border-none shadow-lg shadow-ios-blue/30 active-press"
            >
              继续
            </Button>
          </Form.Item>
        </Form>
      )}

      {/* 步骤1: 确认邮箱 */}
      {currentStep === 1 && (
        <Form form={emailForm} layout="vertical" onFinish={handleSendCode} className="apple-form">
          <div className="mb-6 p-5 rounded-2xl bg-ios-blue/5 border border-ios-blue/10">
            <div className="flex items-center gap-2 mb-2 text-ios-blue font-black">
              <InfoCircleOutlined />
              <span>验证身份</span>
            </div>
            <p className="text-[13px] text-ios-gray-label font-medium leading-relaxed">
              账号 <span className="text-black dark:text-white font-bold">{username}</span> 绑定的邮箱为：
              <span className="block mt-1 text-ios-blue font-bold text-[15px]">{maskedEmail}</span>
              请输入完整邮箱以验证。
            </p>
          </div>
          
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "请输入邮箱地址" },
              { type: "email", message: "请输入正确的邮箱地址" },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-ios-gray-label" />}
              placeholder="完整邮箱地址"
              className="apple-input h-14"
            />
          </Form.Item>
          <Form.Item className="mt-8">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="h-14 rounded-2xl text-[17px] font-black bg-ios-blue border-none shadow-lg shadow-ios-blue/30 active-press"
            >
              发送验证码
            </Button>
          </Form.Item>
        </Form>
      )}

      {/* 步骤2: 输入验证码和新密码 */}
      {currentStep === 2 && (
        <Form 
          form={resetForm} 
          layout="vertical" 
          onFinish={handleResetPassword} 
          className="apple-form"
          autoComplete="off"
        >
          <p className="text-center text-ios-gray-label text-sm mb-6 font-medium leading-relaxed">
            验证码已发送至 <span className="text-ios-blue font-bold">{email}</span><br/>
            <span className="text-xs opacity-70">请在 5 分钟内完成验证</span>
          </p>

          <Form.Item
            name="code"
            rules={[
              { required: true, message: "请输入验证码" },
              { len: 6, message: "请输入 6 位数字验证码" },
              { pattern: /^\d{6}$/, message: "验证码必须是 6 位数字" },
            ]}
          >
            <div className="flex gap-3 items-stretch">
              <Input
                prefix={<SafetyCertificateOutlined className="text-ios-gray-label" />}
                placeholder="输入 6 位验证码"
                className="apple-input h-14 flex-1 font-mono tracking-[0.3em] text-lg font-bold text-center"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                onInput={(e: FormEvent<HTMLInputElement>) => {
                  // 仅允许输入数字
                  const target = e.currentTarget;
                  target.value = target.value.replace(/\D/g, '');
                }}
              />
              <Button
                className="h-14 min-w-[80px] rounded-2xl px-4 font-bold border-none bg-ios-gray/50 dark:bg-white/10 active-press text-black dark:text-white disabled:opacity-50"
                onClick={handleResendCode}
                disabled={countdown > 0}
                loading={loading}
              >
                {countdown > 0 ? `${countdown}s` : "重发"}
              </Button>
            </div>
          </Form.Item>

          <Form.Item
            name="newPassword"
            rules={passwordRules}
            extra="至少 8 位，需包含大小写字母、数字和符号"
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined className="text-ios-gray-label" />}
              placeholder="输入新密码"
              className="apple-input h-14"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={["newPassword"]}
            hasFeedback
            rules={[
              { required: true, message: "请确认密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-ios-gray-label" />}
              placeholder="再次输入新密码"
              className="apple-input h-14"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item className="mt-8">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="h-14 rounded-2xl text-[17px] font-black bg-ios-blue border-none shadow-lg shadow-ios-blue/30 active-press"
            >
              重置密码
            </Button>
          </Form.Item>
        </Form>
      )}

      {/* 步骤3: 完成 */}
      {currentStep === 3 && (
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-ios-green/10 text-ios-green rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            <CheckCircleOutlined />
          </div>
          <h2 className="text-xl font-black mb-2 dark:text-white">密码已重置</h2>
          <p className="text-ios-gray-label font-medium text-sm mb-10">
            密码已更新，现在可以使用新密码登录。
          </p>
          <Button 
            type="primary" 
            block 
            className="h-14 rounded-2xl text-[17px] font-black bg-ios-blue border-none shadow-lg shadow-ios-blue/30 active-press" 
            onClick={onBack}
          >
            返回登录
          </Button>
        </div>
      )}
    </div>
  );
}
