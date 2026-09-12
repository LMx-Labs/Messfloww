# Messfloww Project Structure

This document outlines the architecture and directory structure of the **Messfloww** repository. The project is organized as a monorepo managed by `pnpm` workspaces, meaning it contains multiple distinct applications and shared packages within a single repository.

## High-Level Overview

The root of the project contains configuration files for the workspace, dependencies, and backend services (Firebase).

```text
Messfloww-main/
│
├── apps/                  # Contains all the frontend applications
├── packages/              # Contains shared code/libraries used across apps
├── tools/                 # Scripts and auxiliary tools for specific hardware/setups
├── docs/                  # Extensive technical documentation and specifications
├── anchor docd/           # Additional technical audits and documentation
│
├── package.json           # Root dependencies and workspace scripts (dev, build, deploy)
├── pnpm-workspace.yaml    # Defines the pnpm workspace (apps/*, packages/*)
├── firebase.json          # Firebase configuration (hosting, functions, etc.)
├── firestore.rules        # Security rules for Cloud Firestore
├── database.rules.json    # Security rules for Firebase Realtime Database
└── README.md              # Main project readme
```

---

## 1. `apps/` (Frontend Applications)

The `apps` directory contains the different user-facing web applications. Each app is built using **Vite**, **TypeScript**, and likely **React**, and has its own `package.json`, `vite.config.ts`, and Firebase hosting configuration.

- **`admin-hq/`**
  - **Purpose:** The administration dashboard for managing the mess operations.
  - **Key contents:** Includes source code (`src/`), Firebase functions (`functions/`), and specific Firestore indexes (`firestore.indexes.json`).
  
- **`inventory-kitchen/`**
  - **Purpose:** The Kitchen Display System (KDS) used by the kitchen staff to view and manage food preparation and inventory.

- **`kiosk-counter/`**
  - **Purpose:** The self-service kiosk application used at the counter. Designed to be run in a silent-print kiosk mode (as noted in the root README) for automatic thermal receipt printing.

- **`student-portal/`**
  - **Purpose:** The web application used by students to interact with the mess (e.g., viewing menus, making requests, scanning QR codes).

---

## 2. `packages/` (Shared Libraries)

This directory contains internal packages that are shared across the different applications in the `apps/` folder. This ensures code reusability and consistency.

- **`shared-core/`**
  - **Purpose:** Contains shared TypeScript logic, types, and potentially reusable UI components. It is imported by the frontend apps to maintain a single source of truth for core domain logic.

---

## 3. `tools/` (Auxiliary Tools)

Contains supplementary scripts and servers that support the main applications, particularly regarding hardware integrations.

- **`kiosk_launcher/`**
  - **Purpose:** Scripts or configurations for launching the browser in kiosk mode (e.g., locking down the OS/browser for the counter kiosk).

- **`print_server/`**
  - **Purpose:** Likely a local service or proxy for handling silent thermal printing from the web applications, interfacing between the browser and local printers.

---

## 4. Documentation (`docs/` & `anchor docd/`)

The repository contains an extensive collection of technical documentation, architectural designs, and patent-style analyses.

- **`docs/`**
  - Contains detailed markdown files covering feature inventories, technical designs (e.g., `12_arch_b_technical_design.md`), prior art reconnaissance, transaction consistency, and concurrency control.
  - Useful for understanding the deep technical and architectural decisions behind Messfloww.

- **`anchor docd/`**
  - Contains audits and readiness checklists, such as `19_technical_audit_production_readiness.md`.

---

## Key Technologies & Commands

- **Package Manager:** `pnpm` (version >= 9)
- **Node Version:** Node >= 18
- **Backend Service:** Firebase (Firestore, Functions, Hosting, Realtime Database)
- **Frontend Build Tool:** Vite (TypeScript)

### Available Workspace Scripts (Run from root)
- `pnpm run dev:student` - Starts the student portal in dev mode.
- `pnpm run dev:admin` - Starts the admin dashboard in dev mode.
- `pnpm run dev:kiosk` - Starts the kiosk app in dev mode.
- `pnpm run dev:kitchen` - Starts the kitchen app in dev mode.
- `pnpm run deploy:all` - Builds all apps and deploys them to Firebase Hosting.
