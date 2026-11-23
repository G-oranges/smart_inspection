package utils

import (
	"strings"
	"testing"
)

// asProduction 模拟非测试二进制，使 IsDevEnvironment 仅由 APP_ENV 决定。
func asProduction(t *testing.T) {
	t.Helper()
	orig := inTestBinary
	inTestBinary = func() bool { return false }
	t.Cleanup(func() { inTestBinary = orig })
}

func TestValidateJWTConfig_ProductionRequiresSecret(t *testing.T) {
	asProduction(t)
	t.Setenv("APP_ENV", "")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("JWT_REFRESH_SECRET", "")

	if err := ValidateJWTConfig(); err == nil {
		t.Fatal("expected error when JWT_SECRET is missing in production")
	}
	if _, err := JWTSecret(); err == nil {
		t.Fatal("JWTSecret must not fall back to default secret in production")
	}
	if _, err := GenerateAccessToken("u1", "ADMIN", 0); err == nil {
		t.Fatal("GenerateAccessToken must fail without secret in production")
	}
}

func TestValidateJWTConfig_ProductionRejectsShortSecret(t *testing.T) {
	asProduction(t)
	t.Setenv("APP_ENV", "production")
	t.Setenv("JWT_SECRET", "short")
	t.Setenv("JWT_REFRESH_SECRET", "")

	err := ValidateJWTConfig()
	if err == nil || !strings.Contains(err.Error(), "长度不足") {
		t.Fatalf("expected length error, got %v", err)
	}

	t.Setenv("JWT_SECRET", strings.Repeat("a", MinJWTSecretLength))
	t.Setenv("JWT_REFRESH_SECRET", "short")
	if err := ValidateJWTConfig(); err == nil {
		t.Fatal("expected error for short JWT_REFRESH_SECRET")
	}

	t.Setenv("JWT_REFRESH_SECRET", "")
	if err := ValidateJWTConfig(); err != nil {
		t.Fatalf("expected valid config, got %v", err)
	}
}

func TestDevEnvironmentAllowsFallback(t *testing.T) {
	asProduction(t)
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "")
	t.Setenv("JWT_REFRESH_SECRET", "")

	if err := ValidateJWTConfig(); err != nil {
		t.Fatalf("dev env should not fail validation: %v", err)
	}
	secret, err := JWTSecret()
	if err != nil || string(secret) != devFallbackJWTSecret {
		t.Fatalf("expected dev fallback secret, got %q, %v", secret, err)
	}
}

func TestTokenRoundTripAndRefreshDerivation(t *testing.T) {
	t.Setenv("JWT_SECRET", strings.Repeat("s", MinJWTSecretLength))
	t.Setenv("JWT_REFRESH_SECRET", "")

	access, err := GenerateAccessToken("u1", "ADMIN", 3)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ParseToken(access)
	if err != nil || claims.ID != "u1" || claims.TokenVersion != 3 {
		t.Fatalf("access round trip failed: %+v, %v", claims, err)
	}

	refresh, err := GenerateRefreshToken("u1", 3)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseToken(refresh); err == nil {
		t.Fatal("refresh token must not be accepted as access token")
	}
	if _, err := ParseRefreshToken(refresh); err != nil {
		t.Fatalf("refresh round trip failed: %v", err)
	}

	derived, _ := JWTRefreshSecret()
	if string(derived) != strings.Repeat("s", MinJWTSecretLength)+"_refresh" {
		t.Fatalf("refresh secret derivation changed: %q", derived)
	}
}
