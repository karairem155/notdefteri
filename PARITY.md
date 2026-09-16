# Goodnotes parity tracker

This tracker is for the current Release A prototype. “Untested” means no iPad-device validation has happened yet. “Partial” means the feature is intentionally smaller than the Goodnotes workflow or has only been verified in CI. “Blocked” means it is deferred or unavailable in this release.

| Capability | Status | Current state |
| --- | --- | --- |
| Native Apple Pencil ink | Untested | PencilKit editor and local persistence are implemented; test on the target iPad. |
| Pen, pencil, highlighter, eraser, lasso | Untested | Toolbar and width/colour controls exist; interaction needs device testing. |
| Pages and paper styles | Partial | Add pages and choose blank, ruled, grid, or dotted paper; ink previews, duplicate, reorder, and delete are implemented but not yet device-tested. Rotate pages, custom dimensions, and templates are deferred. |
| Notebook library | Partial | Create, search titles, favourite, trash, restore, permanently delete, and rename; folders, covers, and global content search are deferred. |
| Local save and recovery | Partial | Simulator tests verified save-and-reopen and preserving an unreadable file; interruption, low-storage, and iPad tests remain. |
| Notebook export and backup | Partial | Share a single editable `.pencilpages` JSON document; batch backup/restore and Files import are deferred. |
| PDF import and annotation | Blocked | Planned for Release B. |
| Search handwritten ink and PDF text | Blocked | Planned for Release C and accuracy evaluation. |
| Audio synced to notes and flashcards | Blocked | Planned for Release C. |
| Handwriting correction, math help, summaries, AI questions | Blocked | Requires a separate on-device feasibility and quality study; this iPad does not support Apple Intelligence. |
| Whiteboards, rich text documents, collaboration, cloud sync | Blocked | Deferred; the app has no backend or account system. |
| Windows build and installation workflow | Partial | Hosted simulator tests, device IPA build, package validation, and artifact upload pass; Windows signing and install/refresh on the target iPad remain unverified. |
