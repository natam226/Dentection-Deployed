# Dentection Cloudflare MVP Implementation Plan

> **Implementation:** Complete the tasks in order and track their verification with checkboxes.

**Goal:** Publish the approved browser application with existing-model analysis, authenticated private history, notes and PDF.

**Architecture:** Static TypeScript application and ONNX Runtime Web, a Cloudflare Worker API, D1 records and KV original images. Access OTP authenticates invited professionals. Browser inference is a prerequisite, not an assumed result.

**Tech Stack:** TypeScript, Vite, ONNX Runtime Web, jsPDF, Workers, D1, KV, Access, Python export tooling.

**Spec:** `docs/desarrollo/specs/2026-10-20-cloudflare-mvp-design.md`, approved in chat 2026-10-20.

## Global Constraints

- Two-hour target, no paid plans, existing model unchanged, Spanish browser UI.
- JPG/JPEG/PNG, 5 MiB maximum original image; preserve original; 500 MiB application storage cap.
- Cloud history is private per authenticated identity; fail closed without Access.
- No training, prescriptions, public signup or automatic patient email.
- Start with ONNX verification and stop that architecture if parity is not demonstrated.

## Review Focus

- Forged or absent identity must never expose records or images.
- Study identity must remain stable with duplicate filenames and retried saves.
- Invalid image or failed save must preserve visible work and explain the failure.
- Note updates and PDF generation must never re-run inference.
- Empty detections and eventual image availability must not be presented as clinical certainty or deleted history.

## Task 1: Export and verify inference

Files: `scripts/export_model.py`, `web/public/model/model.onnx`, `web/public/model/metadata.json`, `web/src/detection.ts`, `web/tests/detection.test.ts`; evidence in ignored `work/`.

Interfaces: `Detection = {classId:number, confidence:number, box:[number,number,number,number]}` in original-image pixels; `decodeDetections(data, dimensions, geometry, conf, iou): Detection[]`; `Geometry={width,height,scale,padX,padY}`.

- [ ] Install isolated CPU export dependencies; export static 640 ONNX opset 17 and names metadata.
- [ ] Add failing tests for YOLOv8 output, class-aware NMS, letterbox reversal and empty results; run and observe failure.
- [ ] Implement decoder and browser preprocessing. Compare Python and browser on same existing notebook image with matching settings; record predictions and parity tolerances.
- [ ] Commit verified inference and dependency lockfiles.

## Task 2: Private cloud API

Files: `web/worker/index.ts`, `web/worker/auth.ts`, `web/worker/studies.ts`, `web/migrations/0001_initial.sql`, `web/wrangler.jsonc`, `web/tests/api.test.ts`.

Interfaces: GET `/api/me`; GET/POST `/api/studies`; GET `/api/studies/:uuid`; PUT `/api/studies/:uuid/image`; GET `/api/studies/:uuid/image`; PATCH `/api/studies/:uuid/notes`; DELETE `/api/studies/:uuid`. POST allocates UUID from client-provided request UUID to make retry idempotent; ownership always from verified Access subject. Study includes id, filename, createdAt, status, modelVersion, parameters, detections, notes, width, height, size, mimeType.

- [ ] Add failing integration tests against local D1/KV for unauthenticated, forged-header and cross-owner reads/updates; invalid IDs and images; quota, idempotent save and normal history.
- [ ] Implement verified Access JWT identity (static-assets router does not forward ctx.access); enforce issuer, audience, signature and expiration, plus origin checks on mutations. Local-only test identities must not be deployable or client-controlled in production.
- [ ] Implement schema, original-image streaming, immutable KV keys, byte/content checks, owner-scoped queries, per-owner daily quota and 500 MiB quota accounting in D1 transactions. Never cache private responses publicly.
- [ ] Run integration suite and commit. Document KV propagation and partial-upload recovery.

## Task 3: Browser workflow and PDF

Files: `web/index.html`, `web/src/main.ts`, `web/src/styles.css`, `web/src/inference.ts`, `web/src/pdf.ts`, `web/src/api.ts`, `PRODUCT.md`, `DESIGN.md`.

Consumes Task 1 Detection and Task 2 API. Produces usable profile, history, upload/analysis workspace, detail/summary, notes save and PDF download. Inference loaded lazily and cached; results retained across interactions. PDF uses current persisted notes; warn/save before export if dirty.

- [ ] Review product context and visual requirements; retain the clinical blue palette and prioritize the review workflow.
- [ ] Add workflow tests for failed save retry and dirty note/export state, then implement state transitions and browser UI.
- [ ] Implement real image decoding, progress, model inference, selectable boxes/table, confidence filter, history/reopen/delete, and separate automatic findings/professional note PDF.
- [ ] Build; test full workflow with local Cloudflare emulator and review PDF and screenshots at desktop and narrow widths. Commit working application.

## Task 4: Publish and verify

Files: `README.md`, deployment instructions, evidence output, progress ledger.

- [ ] Initiate Wrangler OAuth; user completes login. Create only this app's D1/KV/Worker and Access app/OTP configuration; no paid subscriptions or unrelated account changes.
- [ ] Apply remote migration, publish static assets/model/API, configure Access allowlist and issuer/audience, verify real OTP login and persist/reopen/download flow.
- [ ] Run complete automated suite and fresh whole-branch review; fix important findings with regression tests. Preserve any unresolved external blocker explicitly.
- [ ] Integrate verified branch into Desktop checkout, leave reproducible instructions, URL and known limitations. Never claim deployment if not verified.

## Execution choice and interface review

The user explicitly approved the design and instructed implementation to begin. Proceed inline without another plan-approval interruption. Task 1 Detection is shared verbatim by API validation and UI; the API paths are fixed here; PDF consumes the same stored record. No conflicting task interfaces identified. Use the available bundled Node/Python runtimes; isolated dependency caches under workspace work/. Native worktree creation cannot target this projectless chat's external Desktop repository, so an ordinary Git worktree was created for that repository.
