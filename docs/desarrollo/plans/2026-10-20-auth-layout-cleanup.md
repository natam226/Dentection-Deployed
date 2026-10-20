# Clean access layout and repository

User requested hiding the lateral panel on login, then removing unused repository contents. Preserve the existing blue palette, authentication, private history, inference and PDF.

## Task 1: Access layout
Hide workspace navigation and account header from the initial HTML while checking the session, on login/registration and during reauthentication. Show the Dentection brand and centered form. Restore workspace after authentication without losing an in-progress study. Extend existing registration/session-recovery tests; verify rendered desktop/mobile.

## Task 2: Repository cleanup and delivery
Remove the superseded Streamlit entry points/helpers and tracked Python caches, obsolete hosting files and unused frontend declarations. Replace legacy README and Python requirements with the current web/export workflow, retaining author credits. Keep weights and notebook because export_model.py uses them, and retain parity tools, migrations and local preview used by documented workflows. Run full tests/build, unused checks, fresh independent read-only review, deploy and integrate into Desktop.

## Review Focus
No workspace chrome before authentication or during session recovery. Valid sessions restore navigation and preserve study/notes. No removed file is needed by current frontend, Worker, export, parity or preview. Preserve user data, model sources, credits and existing account secrets; no database resets or secret changes.

## Completed verification

- Full suite41/41 and frontend/Worker build passed in the isolated checkout and again after Desktop integration. Both TS configs enforce unused locals/parameters checks.
- Independent read-only review: no blocking or minor findings; ready to merge. Visual detector returned no findings.
- Rendered login/register without workspace chrome at1440px and320px locally; authenticated local preview restores navigation and history.
- Production version `eb76e2ff-ce76-416b-b141-262799c29c36`: existing real session loaded the workspace, logout showed only brand/form, real Turnstile completed. Production screenshots checked at1440px and390px.
- Original weight SHA256 still matches committed model metadata; notebook parses and exporter syntax is valid. Unchanged model was not re-exported. Optional fresh Python environment was not installed for this source-only cleanup.
- Removed8obsolete files and unused frontend declarations; retained documented export/parity/preview workflows and original author credits. No database reset, model replacement or secret change.
- Removed orphaned worktree administration records with standard `git worktree prune` after clearing stale OneDrive read-only directory flags. Active worktree record preserved.
- Rulings: executor owns live/render verification and test execution; independent reviewer inspected source read-only. Existing network-recovery UX and clinical validation remain outside this change, with no new claims. Cost if needed: separate feature/validation work.
