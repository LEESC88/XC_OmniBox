# Active Architecture Context: P1 Completed

## 1. Status: P1 Complete, Ready for P2
- P1-1 Tool Chaining: Zero-copy File/Blob/Text bus active across all toolboxes.
- P1-2 Self-Healing: Supervisor auto-recovers Python backend with transparent retry.

## 2. Core Contracts & APIs
- `toolBus.emit(target, payload)`: In-memory pipeline between tools.
- `SendToButton`: Quick-action tool redirection on all output artifacts.
- IPC `backend:restart` & `backend:check-health`: Process supervisor in `main.js`.
- `apiFetch` in `api.ts`: Auto-restarts backend on network fail and retries.

## 3. Boundary & Error Isolation
- In-memory ObjectURL/Blob conversion prevents redundant disk write cycles.
- Subscriptions clean up on unmount to prevent memory leaks.
- Supervisor respects `isQuitting` flag to avoid zombie processes.
