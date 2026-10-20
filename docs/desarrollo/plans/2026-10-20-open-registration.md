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

## Completed verification

- Deployed Worker version `a5e59974-2b26-499e-989b-e241000d0c16` with the real Managed Turnstile widget and Worker secret; no paid plan activated.
- Full suite: 41/41 tests in eight files; frontend/Worker compilation passed. Repeated tests/build on Desktop after fast-forward integration.
- Independent review completed; confirmed provider loader defect fixed with RED-to-GREEN regression. Narrow mobile widget adjustment also verified RED-to-GREEN; browser checks at desktop and320px.
- Missing registration token returns400, forged registration/login token returns403 with no session cookie in production.
- User completed real open registration. Read-only D1 check confirmed a new profile/account at23:33UTC with one active session and zero studies. Existing account still has its original study. No user password was accessed.
- Deferred minors: timeout for public Turnstile configuration fetch; explicit negative-login session-row count test. Existing shared verifier rejects before account lookup/session creation.
- Email ownership/license verification and password recovery remain excluded and documented. Model and quota policy unchanged.
