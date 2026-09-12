# Documentation Conventions

## File Naming Rules
- Use lowercase alphanumeric characters.
- Use underscores (`_`) instead of spaces.
- Keep names concise but descriptive (e.g., `feature_inventory.md` rather than `inventory of all the features.md`).
- Number prefixes (e.g., `01_`, `02_`) are allowed for ordering sequences of research files.

## Folder Organization Rules
- Documents must belong to one of the predefined thematic folders (`01_product_and_scope`, `02_system_architecture`, etc.).
- Do not create subfolders within these thematic folders unless strictly necessary for massive asset collections (e.g., `images/`).
- The root `docs/` folder should only contain `README.md` and the thematic directories.

## Document Status Labels
When writing formal specifications or analyses, use one of the following labels at the top of the document (or in frontmatter):
- **DRAFT**: Work in progress, not ready for review or implementation.
- **ACTIVE**: Currently being implemented or is the current source of truth.
- **VERIFIED**: The technical implementation has been audited and matches this document.
- **SUPERSEDED**: Replaced by a newer document (should link to the newer document).
- **ARCHIVED**: No longer relevant but kept for historical context. Should be moved to `99_archive/`.

## Rules for Updating Internal Links
- When moving files, always update internal relative Markdown links (`[Link](../folder/file.md)`).
- Ensure links point to the `.md` extension.
- Use explicit anchors (`#section-name`) if referencing specific parts of a document.
