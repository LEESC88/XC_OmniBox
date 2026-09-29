# Active Architecture Context: P3 Completed & Release 1.2.0

## 1. Status: P3 Shortcuts & Release 1.2.0 Complete
- P3-1 Shortcuts: Ctrl+Enter (Run), Ctrl+S (Save), Ctrl+1~5 (Nav), Ctrl+/, Ctrl+,, Esc.
- P3-2 Smart Clipboard: Ctrl+V global auto-routing for images and text.
- Release: Version bumped to 1.2.0 across frontend, backend, electron, docs.

## 2. Core Contracts & APIs
- `shortcutBus`: Central event bus for execution and download triggers.
- `[data-primary-action="true"]`: Universal DOM hook for primary execution.
- `[data-download-result="true"]`: Universal DOM hook for quick result download.
- `ShortcutsModal.tsx`: Visual cheat sheet for all system shortcuts.

## 3. Boundary & Error Isolation
- Clipboard listener ignores inputs/textareas to protect text entry.
- Keydown handler intercepts Ctrl+S to prevent default browser page save.
