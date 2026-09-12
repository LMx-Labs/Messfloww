# MessFloww Documentation

> This documentation structure is the central knowledge base for MessFloww development, architecture, validation, and patent research.

## Folder Structure

- **`00_project_context/`**: Contains core project guidelines, base documentation, and project structure rules.
  - Important Docs: `project_structure.md`, `base.md`, `documentation_conventions.md`

- **`01_product_and_scope/`**: Defines the product features and exact boundaries for current and future development phases.
  - Important Docs: `phase_1_scope.md`, `02_messfloww_feature_inventory.md`

- **`02_system_architecture/`**: High-level system design, domain models, and state machines governing the application.
  - Important Docs: `multi_mess_architecture.md`, `domain_model.md`, `transaction_state_machines.md`

- **`03_current_system/`**: Inventory of the existing codebase, implementation gaps, and technical audits.
  - Important Docs: `current_system_inventory.md`, `implementation_gap_report.md`

- **`04_transaction_engine/`**: Detailed analysis and validation of the transactional core, concurrency control, and idempotency.
  - Important Docs: `16_concurrency_control_and_fencing.md`, `v0_evidence_and_validation_plan.md`

- **`05_patent_research/`**: Prior art analysis, novelty comparisons, and overlaps.
  - Important Docs: `01_reference_patent.md`, `17_deep_prior_art_landscape.md`

- **`06_invention_development/`**: Refinement of technical inventions and claim element matrices.
  - Important Docs: `13_software_invention_refinement.md`, `patent_candidate_technical_inventory.md`

- **`07_patent_drafting/`**: The final and draft patent applications and related diagrams.
  - Important Docs: `Messfloww_patent_draft.md`, `example patent.md`

- **`99_archive/`**: Obsolete, superseded, or duplicate files that are kept for historical reference.

## Recommended Reading Order

1. Read the **`01_product_and_scope/`** files to understand what MessFloww is building right now.
2. Review **`02_system_architecture/`** to grasp the core entities and state transitions.
3. Check **`03_current_system/`** to see where the current repository stands against the architecture.
4. For deeper technical research on concurrent transactions and patentability, proceed to **`04_transaction_engine/`** and **`06_invention_development/`**.
