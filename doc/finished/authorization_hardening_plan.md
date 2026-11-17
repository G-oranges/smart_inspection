# Authorization Hardening Plan (Backend)

## Purpose
Address missing server-side authorization checks for sensitive endpoints (create/delete users, modify permissions, delete audit logs). This plan defines a permission model, a route-to-permission mapping, middleware enforcement, controller double-checks, audit requirements, and tests.

## Scope
In scope (high risk):
- User management: create/update/delete users, reset password, generate temporary password
- Permission/role management: role-permission matrix updates, user overrides, batch overrides
- Audit log access: list/delete logs
- Settings update (already role-gated, but align with permission model)

Out of scope (for this task):
- Token storage, refresh token revocation, or other authn changes
- Frontend UX changes beyond permission-based UI gating

## Goals
- Enforce authorization on all sensitive endpoints with 403 on unauthorized access
- Centralize policy mapping (route -> required permission/role)
- Keep PermissionService as the source of truth (cached)
- Ensure audits capture operator and, for sensitive actions, a reason field

## Current Gaps
- Only AuthMiddleware is applied; no per-endpoint authorization checks
- Controllers do not verify role/permissions before sensitive actions
- Frontend permissions are only UI-level and can be bypassed

## Proposed Permission Model
Use existing permission entities (permission table) and PermissionService cache.
Define a small, explicit set of permission codes for sensitive actions.
Suggested codes (examples, adjust to existing conventions):
- USER_READ, USER_CREATE, USER_UPDATE, USER_DELETE
- USER_RESET_PASSWORD, USER_TEMP_PASSWORD
- ROLE_READ, ROLE_UPDATE
- PERMISSION_READ, PERMISSION_UPDATE
- AUDIT_READ, AUDIT_DELETE
- SETTINGS_UPDATE

## Route-to-Permission Mapping (Initial)
Map sensitive endpoints to permissions, optionally with role fallback.

- POST /api/users -> USER_CREATE
- PUT /api/users/:id -> USER_UPDATE (allow self-update subset if desired)
- DELETE /api/users -> USER_DELETE
- PUT /api/users/:id/reset-password -> USER_RESET_PASSWORD
- POST /api/users/:id/temporary-password -> USER_TEMP_PASSWORD

- GET /api/roles -> ROLE_READ
- GET /api/permissions/me -> PERMISSION_READ
- GET /api/permissions/roles -> PERMISSION_READ
- PUT /api/permissions/roles/:roleId -> PERMISSION_UPDATE (ADMIN only)
- GET /api/permissions/users/:userId -> PERMISSION_READ
- PUT /api/permissions/users/:userId -> PERMISSION_UPDATE (ADMIN only)
- PUT /api/permissions/batch-overrides -> PERMISSION_UPDATE (ADMIN only)

- GET /api/audit-logs -> AUDIT_READ
- DELETE /api/audit-logs -> AUDIT_DELETE (ADMIN only)

- PUT /api/settings -> SETTINGS_UPDATE (ADMIN only)

Notes:
- ADMIN-only actions can be represented as RequireRole("ADMIN") plus permission checks.
- For self-service operations, add explicit checks (id == userId) or dedicated permissions.

## Middleware Design
1) AuthMiddleware remains the entry gate.
2) Add a permission injector middleware:
   - Compute user permissions via PermissionService
   - Cache is already implemented (L1 + Redis)
   - Store on context: c.Set("permissions", []string{...})
3) Add RequirePermission middleware:
   - Accepts one or more permission codes
   - If missing -> 403
4) Add RequireRole middleware:
   - Accepts role list (ADMIN, etc.)
   - If role mismatch -> 403
5) Optional: RequireAny (role OR permission) helper for transitional rollout.

## Controller Double-Checks (Defense in Depth)
For the highest-risk controllers, add explicit checks even if middleware exists.
Targets:
- user_controller: CreateUser, UpdateUser, DeleteUsers, ResetPassword, GenerateTemporaryPassword
- permission_controller: UpdateRolePermissions, UpdateUserOverrides, BatchUpdateUserOverrides
- audit_controller: DeleteLogs

Add a structured error response: { message: "Forbidden" }

## Auditing Requirements
- Log unauthorized access attempts with operator ID, IP, and route
- For sensitive mutations, require a "reason" field in request body
  - Store in audit log description or a dedicated field

## Implementation Steps
1) Define permission codes in DB (seed/migration) and map to roles
2) Add middleware (permission injector + RequirePermission/RequireRole)
3) Wire middleware in router.go for sensitive routes
4) Add controller-level checks where needed
5) Update audit logging to capture reason and unauthorized access
6) Add tests and verify with existing UI

## Tests
- Unauthorized/insufficient permission -> 403
- Admin role -> allowed
- Role without permission -> 403
- Self-update allowed only where explicitly permitted
- Audit log deletion blocked for non-admins

## Rollout Strategy
- Phase 1: Log-only mode (feature flag AUTHZ_ENFORCE=false), record would-block decisions
- Phase 2: Enforce mode (AUTHZ_ENFORCE=true), monitor error rates
- Provide a fallback checklist to grant required permissions to roles

## Acceptance Criteria
- All sensitive routes return 403 without proper permission/role
- Admin role can complete all sensitive operations
- Audit logs record operator and reason for sensitive changes
- No new unauthorized access paths discovered in integration tests

## File/Code Touchpoints
- backend-go/internal/router/router.go
- backend-go/internal/middleware/auth.go (and new authz middleware)
- backend-go/internal/controller/user_controller.go
- backend-go/internal/controller/permission_controller.go
- backend-go/internal/controller/audit_controller.go
- backend-go/internal/service/permission_service.go

