<!-- blocks-skills:start -->
## SELISE Blocks

These rules govern Blocks work in this repo. Skills are vendored at `.codex/skills/<name>/SKILL.md`
(Codex additionally discovers the same set natively via `.agents/skills/`; Claude Code via `.claude/skills/`).
Read the vendored copy directly; there is no CLI command that serves a skill. Re-vendored automatically
by Studio before every run.

Match the task to a skill by the `description` in its `SKILL.md`, then read that skill and follow it. Never expect the owner to name a skill — choosing one is your job. If a task spans several, start with the one that owns the first concrete step.

Installed Blocks skills:

- `blocks-bootstrap`
- `blocks-captcha`
- `blocks-data-gateway-configuration`
- `blocks-data-gateway-crud`
- `blocks-data-storage`
- `blocks-frontend-local-https`
- `blocks-iam-access-control`
- `blocks-iam-account`
- `blocks-iam-mfa`
- `blocks-iam-organizations`
- `blocks-iam-sso-oidc-configuration`
- `blocks-iam-sso-oidc-implementation`
- `blocks-iam-users`
- `blocks-localization-configuration`
- `blocks-localization-implementation`
- `blocks-mail`
- `blocks-notification`
- `blocks-notifier`
- `blocks-release-deployment`
- `blocks-secrets`
- `blocks-storage-configuration`
- `blocks-workflow`
<!-- blocks-skills:end -->
