package email

import (
	"crypto/rand"
	"crypto/tls"
	"fmt"
	"math/big"
	"os"
	"strconv"
	"strings"
	"time"

	"gopkg.in/gomail.v2"
)

// Config 邮件服务配置
type Config struct {
	Host     string // SMTP 服务器地址
	Port     int    // SMTP 端口
	Username string // 发件人邮箱账号
	Password string // 邮箱密码或授权码
	From     string // 发件人显示名称
	SSL      bool   // 是否启用 SSL
}

// Service 邮件服务
type Service struct {
	config Config
}

// NewService 创建邮件服务实例
func NewService() *Service {
	portStr := os.Getenv("SMTP_PORT")
	port, _ := strconv.Atoi(portStr)
	if port == 0 {
		port = 465 // 默认 SSL 端口
	}

	sslStr := os.Getenv("SMTP_SSL")
	ssl := sslStr != "false" // 默认启用 SSL

	return &Service{
		config: Config{
			Host:     os.Getenv("SMTP_HOST"),
			Port:     port,
			Username: os.Getenv("SMTP_USERNAME"),
			Password: os.Getenv("SMTP_PASSWORD"),
			From:     os.Getenv("SMTP_FROM"),
			SSL:      ssl,
		},
	}
}

// IsConfigured 检查邮件服务是否已配置
func (s *Service) IsConfigured() bool {
	return s.config.Host != "" && s.config.Username != "" && s.config.Password != ""
}

// SendMail 发送邮件
func (s *Service) SendMail(to, subject, body string) error {
	if !s.IsConfigured() {
		return fmt.Errorf("邮件服务未配置，请检查环境变量 SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD")
	}

	m := gomail.NewMessage()

	// 解析发件人配置
	// 支持格式: "显示名称 <email@domain.com>" 或纯邮箱 "email@domain.com"
	fromName := os.Getenv("SMTP_FROM_NAME") // 可选：单独配置显示名称
	fromAddr := s.config.Username           // 默认使用登录账号作为发件地址

	if fromName != "" {
		// 使用 SetAddressHeader 正确处理中文名称
		m.SetAddressHeader("From", fromAddr, fromName)
	} else if s.config.From != "" {
		// 如果 SMTP_FROM 是纯邮箱地址，直接使用
		// 否则尝试使用 Username
		if isValidEmail(s.config.From) {
			m.SetHeader("From", s.config.From)
		} else {
			// SMTP_FROM 可能包含显示名称，回退使用 Username
			m.SetHeader("From", s.config.Username)
		}
	} else {
		m.SetHeader("From", s.config.Username)
	}

	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", body)

	d := gomail.NewDialer(s.config.Host, s.config.Port, s.config.Username, s.config.Password)

	if s.config.SSL {
		d.TLSConfig = &tls.Config{
			InsecureSkipVerify: false,
			ServerName:         s.config.Host,
		}
	}

	return d.DialAndSend(m)
}

// isValidEmail 简单检查是否是有效的纯邮箱地址格式
func isValidEmail(email string) bool {
	// 简单检查：包含 @ 且不包含空格和尖括号
	return len(email) > 3 &&
		strings.Contains(email, "@") &&
		!strings.Contains(email, " ") &&
		!strings.Contains(email, "<") &&
		!strings.Contains(email, ">")
}

// GenerateVerificationCode 生成6位数字验证码（使用加密安全随机数，避免可预测）
func GenerateVerificationCode() string {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		panic(fmt.Sprintf("crypto/rand unavailable: %v", err))
	}
	return strconv.Itoa(int(n.Int64()) + 100000) // 100000 ~ 999999
}

// SendPasswordResetEmail 发送密码重置验证码邮件
func (s *Service) SendPasswordResetEmail(to, code, fullName string) error {
	subject := "【宿舍卫生查寝系统】密码重置验证码"

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f9; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; }
        .content { padding: 30px; }
        .greeting { color: #333; font-size: 16px; margin-bottom: 20px; }
        .code-box { background: linear-gradient(135deg, #f5f7fa 0%%, #e8ecf1 100%%); border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0; }
        .code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 0; }
        .tips { color: #666; font-size: 14px; line-height: 1.8; }
        .tips li { margin-bottom: 8px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 15px; margin-top: 20px; border-radius: 4px; }
        .warning p { color: #856404; margin: 0; font-size: 13px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 密码重置验证码</h1>
        </div>
        <div class="content">
            <p class="greeting">尊敬的 <strong>%s</strong>，您好！</p>
            <p style="color: #555;">您正在申请重置密码，请使用以下验证码完成操作：</p>
            <div class="code-box">
                <p class="code">%s</p>
            </div>
            <ul class="tips">
                <li>⏰ 验证码有效期为 <strong>5 分钟</strong></li>
                <li>🔒 请勿将验证码告知任何人</li>
                <li>❌ 如非本人操作，请忽略此邮件</li>
            </ul>
            <div class="warning">
                <p>⚠️ 如果您没有请求重置密码，请检查您的账户安全或联系系统管理员。</p>
            </div>
        </div>
        <div class="footer">
            <p>此邮件由系统自动发送，请勿回复</p>
            <p>宿舍卫生查寝系统 © %d</p>
        </div>
    </div>
</body>
</html>
`, fullName, code, time.Now().Year())

	return s.SendMail(to, subject, body)
}
