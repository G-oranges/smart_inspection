# App.css Class Usage Audit

- Date: 2026-03-07
- Scope: `frontend/src/App.css` custom class selectors
- Method: AST scan (`className` + `class` + `clsx/classnames/cn` string tokens)

## Summary

- Total class selectors in App.css: 493
- Custom classes (non-`ant-*`): 365
- Used by class tokens: 84
- Unused candidate classes: 281
- Used but only legacy-defined: 0
- Used and already has component overrides: 84

## This Round

- Migrated account-permission/form helper cluster from App.css into component override file:
  `control-card`, `section-header`, `section-title`, `hero-hint`, `stack`, `full-row`,
  `modal-form`, `modal-grid`, `field-block`, `field-label`, `error`, `switch`, `slider`, `loading-screen`
- Migrated final generic legacy cluster into component overrides:
  `card`, `flex-row`, `deduction-item-row`, `glass-table`
- New file: `frontend/src/styles/components/account-permission.css`
- Updated files: `frontend/src/styles/components/utilities.css`, `frontend/src/styles/components/table-macos.css`
- Entry import added in `frontend/src/styles/index.css`
- Removed `@import '../../App.css'` from `frontend/src/styles/legacy/legacy.css`
- Removed `frontend/src/styles/legacy/legacy.css` and switched to direct vendor import in style entry

## Used But Only Legacy-Defined

- None (all currently used App.css custom classes now have component-level overrides).

## Unused Candidate Classes (Top 120)

Candidates only. Review before deletion (dynamic class names may exist).

- `action-bar`
- `action-tile`
- `action-tile-grid`
- `actions`
- `actions-row`
- `anticon`
- `anticon-check`
- `anticon-close-circle`
- `anticon-exclamation-circle`
- `anticon-search`
- `app-container-responsive`
- `apple-dropdown`
- `apple-popover-glass`
- `auto-responsive-grid`
- `badge`
- `btn-inline-text`
- `btn-secondary`
- `building-card`
- `capacity-meter`
- `capsule-row`
- `capsule-select`
- `capsule-stepper`
- `card-field`
- `card-header-left`
- `card-header-right`
- `card-subtitle`
- `card-title`
- `card-title-group`
- `checkbox`
- `close-btn`
- `compact-header-row`
- `compact-nav-header`
- `content`
- `dashboard-page`
- `dashboard-score-content`
- `deduction-actions`
- `deduction-capsule`
- `deduction-footer`
- `deduction-grid`
- `deduction-info`
- `deduction-item`
- `deduction-list`
- `deduction-meta`
- `deduction-name`
- `deduction-row`
- `deduction-select-wrapper`
- `desktop-actions`
- `desktop-only-submit-area`
- `detail-card`
- `divider`
- `dot`
- `drag-handle`
- `drawer`
- `drawer-header`
- `entry-form`
- `entry-grid`
- `entry-grid-layout`
- `entry-layout`
- `entry-left`
- `entry-right`
- `error-bar`
- `executor-tags`
- `eyebrow`
- `fab-button`
- `field`
- `field-inline`
- `field-key`
- `field-label-input`
- `field-settings-card`
- `field-settings-head`
- `field-settings-list`
- `field-settings-row`
- `field-toggle`
- `field-value`
- `fill`
- `filter-grid`
- `filters`
- `floor-grid`
- `floor-number`
- `footer-hint`
- `footer-inner`
- `forgot-header`
- `forgot-header-left`
- `forgot-header-right`
- `forgot-password-card`
- `forgot-password-link`
- `forgot-password-steps`
- `forgot-tips`
- `form-actions`
- `form-card`
- `form-section-card`
- `form-section-title`
- `gap-lg`
- `ghost-link`
- `glass-btn`
- `glass-btn-gradient`
- `glass-btn-rect`
- `glass-list`
- `glass-list-item`
- `glass-pagination`
- `glass-photo-wall`
- `glass-score`
- `glass-select`
- `glass-upload`
- `grid-two`
- `hero-actions`
- `hero-card`
- `hero-copy`
- `hero-eyebrow`
- `hero-header-row`
- `hero-highlight`
- `hero-meta-row`
- `hero-pill`
- `hero-row-primary`
- `hero-shell`
- `hero-subtitle`
- `hero-title`
- `icon-box`
- `icon-only`
- `import-btn`

## Raw Data

- Full JSON report: `frontend/style-audit.appcss.ast.json`
