# Clean access layout and repository

User requested hiding the lateral panel on login, then removing unused repository contents. Preserve the existing blue palette, authentication, private history, inference and PDF.

## Task 1: Access layout
Hide workspace navigation and account header from the initial HTML while checking the session, on login/registration and during reauthentication. Show the Dentection brand and centered form. Restore workspace after authentication without losing an in-progress study. Extend existing registration/session-recovery tests; verify rendered desktop/mobile.

## Task 2: Repository cleanup and delivery
Remove the superseded Streamlit entry points/helpers and tracked Python caches, obsolete hosting files and unused frontend declarations. Replace legacy README and Python requirements with the current web/export workflow, retaining author credits. Keep weights and notebook because export_model.py uses them, and retain parity tools, migrations and local preview used by documented workflows. Run full tests/build, unused checks, fresh independent read-only review, deploy and integrate into Desktop.

## Review Focus
No workspace chrome before authentication or during session recovery. Valid sessions restore navigation and preserve study/notes. No removed file is needed by current frontend, Worker, export, parity or preview. Preserve user data, model sources, credits and existing account secrets; no database resets or secret changes.
