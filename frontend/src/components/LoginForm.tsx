import { Form, Input, Button, Typography } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  SunOutlined,
  MoonOutlined,
} from "@ant-design/icons";
import type { ThemeMode } from "../types/app";

const { Text } = Typography;

interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
  loading?: boolean;
  error?: string | null;
  onForgotPassword?: () => void;
  theme?: ThemeMode;
  toggleTheme?: () => void;
}

/**
 * 登录表单组件 - Apple HIG 深度定制版
 */
export default function LoginForm({
  onLogin,
  loading,
  error,
  onForgotPassword,
  theme,
  toggleTheme,
}: LoginFormProps) {
  const [form] = Form.useForm();

  const handleSubmit = (values: { username: string; password: string }) => {
    onLogin(values.username.trim(), values.password);
  };

  return (
    <div className="glass-panel w-full max-auto p-8 rounded-[32px] overflow-hidden animate-apple-in" style={{ maxWidth: '400px' }}>
      {/* 顶部控制栏 */}
      <div className="flex justify-end mb-6">
        <div className="bg-ios-gray/50 dark:bg-white/10 p-1 rounded-full flex items-center gap-2">
          <SunOutlined className={`text-xs px-2 py-1 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow-sm text-ios-orange' : 'text-ios-gray-label'}`} onClick={theme === 'dark' ? toggleTheme : undefined} />
          <MoonOutlined className={`text-xs px-2 py-1 rounded-full transition-all ${theme === 'dark' ? 'bg-[#636366] shadow-sm text-ios-yellow' : 'text-ios-gray-label'}`} onClick={theme === 'light' ? toggleTheme : undefined} />
        </div>
      </div>

      {/* 品牌区域 */}
      <div className="text-center mb-10">
        <h1 className="text-[28px] font-black tracking-tight text-black dark:text-white leading-tight mb-2">
          查寝管理系统
        </h1>
        <p className="text-[14px] font-bold text-ios-gray-label uppercase tracking-widest">
          Smart Inspection AI
        </p>
      </div>

      {/* 登录表单 */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="apple-form"
        size="large"
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: "请输入用户名" }]}
        >
          <Input
            id="username"
            name="username"
            prefix={<UserOutlined className="text-ios-gray-label" />}
            placeholder="用户名"
            className="apple-input h-14"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: "请输入密码" }]}
          className="!mb-4"
        >
          <Input.Password
            id="password"
            name="password"
            prefix={<LockOutlined className="text-ios-gray-label" />}
            placeholder="密码"
            className="apple-input h-14"
            autoComplete="current-password"
            iconRender={(visible) =>
              visible ? (
                <EyeTwoTone twoToneColor="#007AFF" />
              ) : (
                <EyeInvisibleOutlined className="text-ios-gray-label" />
              )
            }
          />
        </Form.Item>

        <div className="flex justify-end mb-8 px-1">
          <button 
            type="button"
            onClick={onForgotPassword}
            className="text-[13px] font-bold text-ios-blue hover:opacity-80 transition-opacity active:scale-95"
          >
            忘记密码？
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-ios-red/10 border border-ios-red/20 text-center">
            <Text type="danger" className="text-[13px] font-bold italic">{error}</Text>
          </div>
        )}

        <Form.Item className="!mb-0">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            className="h-14 rounded-2xl text-[17px] font-black bg-ios-blue border-none shadow-lg shadow-ios-blue/30 active-press"
          >
            {loading ? "正在验证..." : "马上进入"}
          </Button>
        </Form.Item>
      </Form>

      {/* 底部版权 */}
      <div className="mt-12 text-center">
        <div className="h-[1px] w-12 bg-ios-gray-label/20 mx-auto mb-4"></div>
        <p className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest opacity-50">
          © 2026 Smart Dormitory Protocol
        </p>
      </div>
    </div>
  );
}
