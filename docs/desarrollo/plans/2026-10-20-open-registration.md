# Open registration with Turnstile

User approved: public name/email/password registration without invitations, free Cloudflare Turnstile, private per-professional history, same blue palette and interface refinement. Existing accounts and studies must continue working. Email ownership verification and password recovery are outside this change.

Implement in an isolated Git worktree with test-driven development and a complete review. Preserve existing accounts and studies during deployment.

## Task 1: Auth API
- Replace invitation requirement with server-side Siteverify for register/login, enforcing success, hostname, action, token limits and fail-closed behavior.
- Atomic account/profile creation; retain hashing, cookies, expiry, revocation, origin/attempt limits and owner-derived study authorization.
- Tests: no invite, invalid/expired/replayed/mismatched token and network failure, duplicate/concurrent account creation and real-session cross-owner denial.

## Task 2: Auth interface
- Keep #274675 palette, legible form and responsive layout. Create-account fields name/email/password/confirmation, no invitation. Integrate managed Turnstile with loading, success, expiry, retry and request-failure reset.
- Preserve same-account in-place recovery and existing work.
- Tests: form modes, registration submission, mismatched password confirmation and expired challenge; full suite and browser checks at desktop/mobile.

## Task 3: Deploy and verify
- Configure one free widget for dentection.natalia-moreno-mon.workers.dev, no pre-clearance or paid plan. Store secret only in Worker secrets; public sitekey config endpoint.
- Full tests/build, independent read-only review and regression fixes. Deploy, verify live registration/login and existing private history, integrate Desktop checkout, document limitations.

## Review Focus
Forged/missing Turnstile must never create accounts or sessions. Siteverify errors fail closed. UI retries use fresh tokens and keep entered fields. Never expose another user's studies; preserve existing account IDs/password hashes. No secrets in Git or screenshots.
