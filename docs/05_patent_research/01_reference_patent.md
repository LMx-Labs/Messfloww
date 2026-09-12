# Reference Patent Technology Map

> **SOURCE DOCUMENTS:**
> - Specification: `example patent.md` (944 lines, 63 KB) — Form-2 Complete Specification under The Patents Act, 1970
> - Drawings: `example patent drawings.md` (320 lines) — Structured representation of 4 drawing sheets

---

## 1. Basic Information

| Field | Detail |
|---|---|
| **Title** | WALLET-BASED MULTI-ENTITY FOOD ORDERING AND MANAGEMENT SYSTEM FOR CAMPUS ENVIRONMENTS |
| **Form** | FORM-2 — Complete Specification under The Patents Act, 1970 (39 of 1970) & The Patents Rules, 2003 |
| **Applicant** | Vellore Institute of Technology (VIT), Vellore Campus, Vellore – 632 014, Tamil Nadu, India |
| **Authorized Agent** | Kuldeep Singh, Indian Patent Agent, Regn. No. IN/PA-4358, Delhi |
| **Filing/Signing Date** | 19th February 2026 (dated on claims, abstract, and specification); digitally signed 08-Mar-2026 15:04:57 |
| **Application Number** | Not specified within the supplied document |
| **Priority Claim** | None — "The present application does not claim priority from any patent application." [0001] |
| **Number of Claims** | 10 (Claims 1–10) |
| **Number of Figures** | 4 (FIG. 1 – FIG. 4) |
| **Field** | Web-based food ordering and management systems; digital wallet mechanisms; campus dining environments |

---

## 2. Stated Problem

The patent identifies four specific technical problems with existing food ordering and payment systems when applied to educational campus mess environments [0009]:

**Problem 1 — External Payment Gateway Dependency**
Conventional online payment systems require integration with external payment gateways. In campus mess environments, physical cash payment at mess counters may be preferred. Existing systems cannot accommodate a physical-payment-first, digital-credit-second model. [0009], [0005]

**Problem 2 — Absence of Per-Entity Wallet Segregation**
Existing multi-vendor platforms do not provide per-entity wallet segregation. There is no mechanism for a single user to maintain separate wallet balances for each distinct food service entity operating within the same campus. [0009], [0006]

**Problem 3 — No Staff-Verified Wallet Recharge**
Conventional systems lack mechanisms for staff-verified wallet recharge where physical payment is confirmed by a human staff member before any digital balance update occurs. [0009]

**Problem 4 — No Instantaneous Automatic Refund**
Existing systems do not provide automatic, instantaneous refund processing upon order cancellation or rejection. Conventional online payment refunds typically require two to ten working days due to multi-party banking reconciliation. [0009], [0060]

**Secondary Pain Points Noted:**
- Long queue waiting times (approximately 15–20 minutes during peak hours) [0098]
- Manual handoffs and physical order slips between counter and kitchen staff [0093]
- Lack of personalized food recommendations in campus dining contexts [0007]

---

## 3. Core System Architecture

### Component Table

| Component ID | Component Name | Function | Inputs | Outputs | Interacts With | Source |
|---|---|---|---|---|---|---|
| **COMP-01** | Server (102) | Central processing unit; manages all food service entities; executes all wallet and order logic | All module inputs; wallet recharge requests; food orders; staff inputs | Updated wallet balances; order status changes; processed orders | All modules; database | [0050], [0051], Claim 1, Abstract, FIG. 1 |
| **COMP-02** | Database (104) | Persistent store of per-user, per-entity wallet balances and all system data | Read/write calls from server and wallet management module | Wallet balances (122); user data; menu data | Server (102); Wallet Management Module (150) | [0072], Claim 1, FIG. 3, Abstract |
| **COMP-03** | Food Service Entity (110) | Independent food service unit (mess/canteen) with its own menu, staff, and wallet scope | Admin registration; staff management | Independent menu (112); scoped wallet balances (122) | Administrator Interface (190); Staff Interface Module (140); User Interface Module (130) | [0050], [0072], Claim 1 |
| **COMP-04** | Menu (112) | Independent catalog of food items for a food service entity | Staff uploads (name, image, ingredients, quantity, price, type); enable/disable flags | Visible food items displayed to users; item availability status | Food Service Entity (110); User Interface Module (130); Staff Interface Module (140) | [0096], [0074] |
| **COMP-05** | User (120) | End-user who places wallet recharge requests and food orders | System login; entity selection; order placement input | Wallet recharge requests; food orders; profile data | User Interface Module (130) | [0051], [0073], Claim 1 |
| **COMP-06** | Wallet Balance (122) | Per-user, per-food-service-entity monetary balance stored in database | Staff-approved recharge amount; order deductions; refunds | Current spendable balance; insufficient balance signal | Database (104); Wallet Management Module (150) | [0054], [0055], Claim 1, Abstract |
| **COMP-07** | User Interface Module (130) | Front-end interface for users; receives all user-side inputs | Wallet recharge requests (entity + amount); food orders; search queries | Displayed menus (with images, ingredients, price); order confirmation; insufficient balance messages | Server (102); Wallet Management Module (150); Recommendation Module (170) | [0072], [0074], Claim 1, FIG. 3 |
| **COMP-08** | Staff Interface Module (140) | Front-end interface for mess staff; receives all staff actions | Staff approval/disapproval of recharge requests; order status changes (accept/reject/ready); staff login credentials (email + password) | Staff input to server; approved recharge events; order status events | Server (102); Wallet Management Module (150); Order Management Module (160); Notification Module (180) | [0052], [0072], [0096], Claim 1, FIG. 3 |
| **COMP-09** | Wallet Management Module (150) | Core financial engine; manages all wallet state transitions | Staff approval signal; order amount from placed food order; order rejection/cancellation signal; wallet balance from database | Updated wallet balance; deducted balance; refunded balance; order prevention signal | Database (104); Server (102); Staff Interface Module (140); User Interface Module (130); Order Management Module (160) | [0072], [0082], Claim 1, FIG. 3, FIG. 4 |
| **COMP-10** | Order Management Module (160) | Manages order lifecycle status | Staff input for order status change (accept/reject/ready); accepted food orders | Order status updates; kitchen-facing interface display; triggers for refund module | Staff Interface Module (140); Wallet Management Module (150); Notification Module (180); Kitchen-facing Interface | [0072], [0083], [0093], Claim 1 |
| **COMP-11** | Recommendation Module (170) | Generates personalized food item recommendations | User ordering history; ordering patterns of similar users | Personalized food item recommendations (excluding previously ordered items) | Server (102); User Interface Module (130) | [0064]–[0066], Claim 2, FIG. 2 |
| **COMP-12** | Notification Module (180) | Sends automated email notifications to users | Order status changes (accept/reject/ready); wallet recharge approval/disapproval events | Email notifications (5 event types); delivery under 5 seconds; 98–99% success rate | Staff Interface Module (140); Server (102); Order Management Module (160) | [0068], [0099], Claim 3, FIG. 2 |
| **COMP-13** | Administrator Interface Module (190) | Centralized management of all food service entities | Admin input: entity registration data (mess name, owner name, address, contact, email, password); edit/delete commands | Registered food service entities (110); staff accounts; system settings | Server (102); Food Service Entity (110); Staff Interface Module (140) | [0095], Claim 4 |
| **COMP-14** | Kitchen-Facing Interface | Digital display of accepted orders for kitchen staff | Accepted order details transmitted from Order Management Module (160) | Visible order queue for kitchen staff; manual removal capability | Order Management Module (160); Staff Interface Module (140) | [0093], [0094] |
| **COMP-15** | Non-Transitory Computer-Readable Medium | Stores executable instructions for the method | Processor execution | Execution of entire food ordering and wallet management method | Server (102); processors (106) | [0100], Claim 9, Claim 10 |

---

## 4. Core Workflow

### Primary Workflow (FIG. 1 + FIG. 3 + FIG. 4 combined)

```
USER (120)
  |
[Step 302/102] User Interface Module (130) receives wallet recharge request
  |  -> Specifies: food service entity (110) + recharge amount
  |
[Step 304/104] Staff Interface Module (140) receives staff input
  |  -> Staff physically verifies payment at mess counter
  |
[Decision 306/106] Server (102): Is recharge request APPROVED by staff?
  |
  +-- NO  --> [Step 308/108] Recharge disapproved --> PROCESS ENDS
  |            Wallet Balance (122) remains unchanged
  |
  +-- YES --> [Step 310/110] Wallet Management Module (150) updates Wallet Balance (122)
                |  -> Balance incremented by recharge amount
                |
              [Step 312/112] User Interface Module (130) receives food order
                |  -> One or more items from Menu (112) of the food service entity (110)
                |
              [FIG.4 Step 402] Server (102) receives food order request
                |
              [Step 404] Wallet Management Module (150) retrieves Wallet Balance (122)
                |  -> From Database (104), scoped to user + food service entity
                |
              [Step 406] Wallet Management Module (150) calculates total order amount
                |
              [Decision 408/314] Is Wallet Balance (122) SUFFICIENT?
                |
                +-- NO  --> [Step 412/316] Order placement PREVENTED
                |            [Step 416] Insufficient balance message displayed to user
                |            PROCESS ENDS
                |
                +-- YES --> [Step 410/318] Wallet Management Module (150) automatically
                              DEDUCTS order amount from Wallet Balance (122)
                              |
                            [Step 414/320] Order submitted to Order Management Module (160)
                              |
                            Order Management Module (160) transmits order details to
                            Kitchen-Facing Interface
                              |
                            [Step 116] Staff Interface Module (140) receives staff input:
                              order status change (accept / reject / mark as ready)
                              |
                            [Decision 118] Is order status REJECTION or CANCELLATION?
                              |
                              +-- YES --> [Step 120] Wallet Management Module (150)
                              |            automatically REFUNDS deducted amount to
                              |            Wallet Balance (122)
                              |            [Instantaneous, within seconds]
                              |
                              +-- NO  --> [Step 122] Order proceeds as accepted or ready
                                           Order details remain visible on kitchen interface
                                           until manually removed by staff
```

### Secondary Workflow — Recommendations + Notifications (FIG. 2)

```
USER (120) places food order
  |
[Step 202] Server (102) receives food order
  |
[Step 204] Recommendation Module (170) analyzes ordering history of user (120)
  |
[Step 206] Recommendation Module (170) identifies other users with similar ordering behaviour
  |  -> Compares ordering patterns across users
  |
[Step 208] Recommendation Module (170) generates personalized recommendations
  |  -> Hybrid algorithm: 60% collaborative filtering + 40% content-based filtering
  |  -> Excludes previously ordered items
  |
[Step 210] Server (102) receives order status change from staff
  |
[Decision 212] Is order status ACCEPTED / REJECTED / READY?
  |
  +-- YES --> [Step 214] Notification Module (180) transmits EMAIL NOTIFICATION to user
  |            -> Event types: order acceptance, order rejection, order readiness,
  |               wallet recharge approval, wallet recharge disapproval
  |
  +-- NO  --> [Step 216] Process ends; no notification transmitted
```

---

## 5. Feature Inventory

| ID | Feature | Technical Mechanism | Where Disclosed | Importance | Claim Type |
|---|---|---|---|---|---|
| **R01** | Multi-entity management on a single server | Server (102) manages a plurality of food service entities (110), each with an independent menu (112) | [0050], [0072], Claim 1, Abstract | **Core** | **Independent** (Claim 1) |
| **R02** | Per-user, per-entity wallet segregation | Database (104) stores a **separate** wallet balance (122) for each user (120) per food service entity (110) | [0072], [0016], Claim 1, Abstract | **Core** | **Independent** (Claim 1) |
| **R03** | User-initiated wallet recharge request | User Interface Module (130) receives wallet recharge requests specifying food service entity (110) and recharge amount | [0051], [0074], Claim 1, FIG. 1 Step 102 | **Core** | **Independent** (Claim 1) |
| **R04** | Physical payment at mess counter preceding digital recharge | User completes physical payment at the mess counter before digital balance update; recharge request is online but payment is physical | [0051], [0052], [0073] | **Core** | **Independent** (Claim 1, by implication through staff verification) |
| **R05** | Staff-verified wallet recharge approval | Staff Interface Module (140) receives staff input for approving or disapproving wallet recharge requests; staff verify physical payment at counter before input | [0052], [0073], [0075], Claim 1, FIG. 1 Step 104, FIG. 3 Step 304 | **Core** | **Independent** (Claim 1) |
| **R06** | Wallet balance update conditional on staff approval | Wallet Management Module (150) updates wallet balance (122) **only** upon staff approval; balance unchanged if disapproved | [0054], [0055], [0078], Claim 1, FIG. 1 Steps 106–110 | **Core** | **Independent** (Claim 1) |
| **R07** | Automatic order amount deduction on placement | Wallet Management Module (150) automatically deducts order amount from wallet balance (122) at the moment of food order placement; no additional user action required | [0057], [0082], Claim 1, FIG. 1 Step 114, FIG. 4 Step 410 | **Core** | **Independent** (Claim 1) |
| **R08** | Staff-driven order status management | Order Management Module (160) receives staff input for changing order status: acceptance, rejection, or marking as ready | [0058], [0083], Claim 1, FIG. 1 Step 116, FIG. 2 Step 210 | **Core** | **Independent** (Claim 1) |
| **R09** | Automatic instantaneous refund on rejection/cancellation | Wallet Management Module (150) automatically refunds deducted amount to wallet balance (122) upon rejection or cancellation; within seconds, contrast with 2–10 working days for banking reconciliation | [0060], [0083], Claim 1, FIG. 1 Steps 118–120 | **Core** | **Independent** (Claim 1) |
| **R10** | Pre-order wallet sufficiency check | Wallet Management Module (150) compares wallet balance (122) against total order amount before allowing placement | [0081], [0086]–[0088], Claim 5, FIG. 3 Decision 314, FIG. 4 Decision 408 | **Important** | **Dependent** (Claim 5) |
| **R11** | Order placement prevention for insufficient balance | Wallet Management Module (150) blocks food order placement when balance is insufficient; insufficient balance message displayed to user | [0081], [0089]–[0092], Claim 5, FIG. 4 Steps 412, 416 | **Important** | **Dependent** (Claim 5) |
| **R12** | Personalized recommendation — 60%/40% hybrid algorithm | Recommendation Module (170) uses 60% collaborative filtering + 40% content-based filtering on user ordering history; excludes previously ordered items; identifies patterns of similar users | [0066], [0101], Claim 2, Claim 7, Claim 10, FIG. 2 Steps 204–208 | **Secondary** | **Dependent** (Claims 2, 7, 10) |
| **R13** | Email notifications for 5 event types | Notification Module (180) transmits email notifications triggered by staff actions for: (1) wallet recharge approval, (2) wallet recharge disapproval, (3) order acceptance, (4) order rejection, (5) order readiness | [0068], [0069], [0099], Claim 3, Claim 8, FIG. 2 Step 214 | **Secondary** | **Dependent** (Claims 3, 8) |
| **R14** | Email delivery performance specification | Notification Module (180) delivers emails with ~98–99% success rate and under 5 seconds delivery time under normal network conditions | [0099] | **Peripheral** | Specification only |
| **R15** | Administrator interface for entity registration | Administrator Interface Module (190) registers food service entities (110) with: mess name, owner name, address, contact, email, password; can also edit and delete entities | [0095], Claim 4 | **Secondary** | **Dependent** (Claim 4) |
| **R16** | Staff account creation per entity | Administrator Interface Module (190) creates staff accounts associated with each food service entity (110) | [0095], Claim 4 | **Secondary** | **Dependent** (Claim 4) |
| **R17** | Digital kitchen-facing interface replacing physical order slips | Accepted order details digitally transmitted to a kitchen-facing interface; kitchen staff view and manage multiple orders simultaneously; orders remain visible after marking as ready until manually removed | [0093], [0094], [0102] | **Important** | Specification only (not in claims) |
| **R18** | Staff menu management (enable/disable, quantity) | Staff upload food items with name, image, ingredients, quantity, price, type; enable/disable items; quantity=0 marks item as unavailable | [0096] | **Secondary** | Specification only (not in claims) |
| **R19** | User profile and staff profile management | Users update personal/account details via user interface; staff update mess name, owner, address, contact via staff interface | [0097] | **Peripheral** | Specification only |
| **R20** | Waiting time reduction claim | System reduces mess waiting time from ~15–20 minutes to ~2–4 minutes (75–85% reduction) through advance digital ordering and wallet-based payment | [0098], [0102] | **Peripheral** | Specification only |

---

## 6. Claims Decomposition

### Claim 1 — Independent System Claim

**C1.1** A food ordering and management system (100) comprising:

**C1.2** a server (102) configured to manage a **plurality of food service entities** (110), each food service entity (110) having an **independent menu** (112);

**C1.3** a database (104) configured to store, for each user (120), a **separate wallet balance** (122) associated with **each food service entity** (110);

**C1.4** a user interface module (130) configured to:
- receive **wallet recharge requests** specifying a food service entity (110) and a recharge amount, AND
- receive **food orders** from users (120);

**C1.5** a staff interface module (140) configured to receive **staff input for approving or disapproving wallet recharge requests**;

**C1.6** a wallet management module (150) configured to:
- **update the wallet balance** (122) associated with a food service entity (110) upon **staff approval** of a corresponding recharge request,
- **automatically deduct** an order amount from the wallet balance (122) **upon placement** of a food order, AND
- **automatically refund** the deducted amount to the wallet balance (122) **upon cancellation or rejection** of the food order;

**C1.7** an order management module (160) configured to receive staff input for **changing order status** including acceptance, rejection, or marking as ready.

---

### Claim 2 — Dependent on Claim 1

**C2.1** The system (100) of claim 1, further comprising:

**C2.2** a **recommendation module (170)** configured to generate personalized food item recommendations for a user (120) based on:
- **ordering history** of the user (120), AND
- **ordering patterns of other users** (120) having **similar ordering behaviour**

---

### Claim 3 — Dependent on Claims 1 or 2

**C3.1** The system (100) of claim 1 or 2, further comprising:

**C3.2** a **notification module (180)** configured to transmit **email notifications** to users (120) based on **staff actions**;

**C3.3** wherein the email notifications include notifications for:
- wallet recharge **approval**
- wallet recharge **disapproval**
- order **acceptance**
- order **rejection**
- order **readiness**

---

### Claim 4 — Dependent on Claims 1 to 3

**C4.1** The system (100) of any of claims 1 to 3, further comprising:

**C4.2** an **administrator interface module (190)** configured to:
- **register food service entities** (110),
- **create staff accounts** associated with each food service entity (110), AND
- **configure system settings** for the plurality of food service entities (110)

---

### Claim 5 — Dependent on Claims 1 to 4

**C5.1** The system (100) of any of claims 1 to 4, wherein:

**C5.2** the wallet management module (150) is further configured to **prevent placement of a food order** when the wallet balance (122) associated with the corresponding food service entity (110) is **insufficient** to cover the order amount.

---

### Claim 6 — Independent Method Claim

**C6.1** A computer-implemented method for managing food ordering across a **plurality of food service entities** (110), the method comprising:

**C6.2** receiving, at a server (102), a **wallet recharge request** from a user (120), the wallet recharge request specifying a **food service entity** (110) and a **recharge amount**;

**C6.3** receiving **staff input** indicating **approval or disapproval** of the wallet recharge request;

**C6.4** **updating a wallet balance** (122) associated with the user (120) and the food service entity (110) **based on the staff input**;

**C6.5** receiving a **food order** from the user (120) for the food service entity (110);

**C6.6** **automatically deducting** an order amount from the wallet balance (122) **upon placement** of the food order;

**C6.7** receiving staff input indicating a **change in order status**; and

**C6.8** **automatically refunding** the deducted amount to the wallet balance (122) **upon the order status indicating rejection or cancellation**.

---

### Claim 7 — Dependent on Claim 6

**C7.1** The method of claim 6, further comprising:

**C7.2** generating **personalized food item recommendations** for the user (120) based on:
- **ordering history** of the user (120), AND
- **ordering patterns of other users** having **similar ordering behaviour**

---

### Claim 8 — Dependent on Claims 6 or 7

**C8.1** The method of claim 6 or 7, further comprising:

**C8.2** transmitting **email notifications** to the user (120) **based on the change in order status**;

**C8.3** wherein the email notifications include notifications for:
- order **acceptance**
- order **rejection**
- order **readiness**

> **Note:** Claim 8 covers only 3 notification event types (order-triggered). Claim 3 (system) covers 5 event types including wallet recharge approval/disapproval. This scope difference between system and method claims is technically significant.

---

### Claim 9 — Independent Medium Claim

**C9.1** A **non-transitory computer-readable medium** storing instructions that, when executed by one or more processors (106), cause the one or more processors (106) to **perform the method of claim 6**.

---

### Claim 10 — Dependent on Claim 9

**C10.1** The non-transitory computer-readable medium of claim 9, wherein the instructions further cause the one or more processors (106) to:

**C10.2** generate **personalized food item recommendations** for the user (120) based on:
- **ordering history** of the user (120), AND
- **ordering patterns of other users** having **similar ordering behaviour**

---

## 7. Figure Decomposition

### FIG. 1 — Wallet Recharge and Food Order Workflow (1/4)

| Attribute | Detail |
|---|---|
| **Figure Reference** | 1/4 |
| **Label** | Workflow 100 |
| **Purpose** | End-to-end computer-implemented method for managing food ordering — from recharge request through order placement to status-triggered refund |
| **Steps Shown** | Step 102 → Step 104 → Decision 106 (approved?) → Step 108 (disapproved/end) OR Step 110 (update wallet) → Step 112 (receive food order) → Step 114 (automatic deduction) → Step 116 (receive order status input) → Decision 118 (rejection/cancellation?) → Step 120 (automatic refund) OR Step 122 (process order) |
| **Key Relationships** | Staff approval is the **gateway** between recharge request and wallet update; order status change is the **gateway** between deduction and potential refund |
| **Corresponding Paragraphs** | [0050]–[0061]; Claim 6; Abstract |

---

### FIG. 2 — Personalized Recommendation and Notification Workflow (2/4)

| Attribute | Detail |
|---|---|
| **Figure Reference** | 2/4 |
| **Label** | Workflow 200 |
| **Purpose** | Recommendation generation pipeline and automated email notification system triggered by staff actions |
| **Steps Shown** | Step 202 (receive food order) → Step 204 (analyze ordering history) → Step 206 (identify similar users) → Step 208 (generate recommendations) → Step 210 (receive order status change) → Decision 212 (accepted/rejected/ready?) → Step 214 (transmit email notification) OR Step 216 (end) |
| **Key Relationships** | Recommendation generation triggered by order receipt; notification gated by Decision 212 on order status |
| **Key Algorithm Detail** | 60% collaborative filtering + 40% content-based filtering; excludes previously ordered items [0066] |
| **Corresponding Paragraphs** | [0062]–[0070]; Claims 2, 3, 7, 8, 10 |

---

### FIG. 3 — System Module Interaction (3/4)

| Attribute | Detail |
|---|---|
| **Figure Reference** | 3/4 |
| **Label** | Workflow 300 |
| **Purpose** | Modular system architecture showing how the four core modules interact during wallet recharge and food ordering |
| **Modules Shown** | User Interface Module (130); Staff Interface Module (140); Wallet Management Module (150); Order Management Module (160) |
| **Steps Shown** | Step 302 (UIM receives recharge request) → Step 304 (SIM receives staff approval) → Decision 306 (approved?) → Step 308 (rejected) OR Step 310 (WMM updates balance) → Step 312 (UIM receives food order) → Decision 314 (balance sufficient?) → Step 316 (order prevented) OR Step 318 (WMM deducts) → Step 320 (OMM processes order status) |
| **Key Relationships** | Wallet balance sufficiency check (Decision 314) is an additional decision gate not in FIG. 1; module boundaries define all data flow |
| **Corresponding Paragraphs** | [0071]–[0083]; Claim 1 |

---

### FIG. 4 — Wallet Sufficiency and Order Placement (4/4)

| Attribute | Detail |
|---|---|
| **Figure Reference** | 4/4 |
| **Label** | Workflow 400 |
| **Purpose** | Dedicated detailed flowchart of the wallet balance sufficiency verification sub-process before order placement |
| **Steps Shown** | Step 402 (receive food order request) → Step 404 (retrieve wallet balance for entity) → Step 406 (calculate total order amount) → Decision 408 (balance sufficient?) → Step 410 (proceed + deduct) → Step 414 (submit to OMM) OR Step 412 (prevent order + notify) → Step 416 (display insufficient balance message) |
| **Key Relationships** | Step 404 explicitly retrieves balance **per food service entity** — confirming entity-scoped balance lookup; Step 406 is a discrete calculation step; prevention path includes both blocking (412) and user notification (416) |
| **Corresponding Paragraphs** | [0084]–[0092]; Claim 5 |

---

## 8. Independent Inventive Concept

Based solely on the document, the central technical combination of this patent appears to be:

> **A wallet-based food ordering system for campus environments in which: (a) each user holds a separate digital wallet balance for each food service entity; (b) wallet recharge is conditional on physical payment verification confirmed by mess staff through a staff interface; (c) order amount is automatically deducted from the entity-scoped wallet at the moment of order placement; and (d) the deducted amount is automatically and instantaneously refunded upon staff-initiated rejection or cancellation of the order — all without integration with external payment gateways.**

The combination of **per-entity wallet segregation** + **staff-verified physical-payment-before-digital-credit** + **automatic deduction-and-refund loop** is the central technical unit, fully recited in both independent claims (Claims 1 and 6). The system claim (Claim 1) defines the architectural components; the method claim (Claim 6) defines the same combination as a sequence of steps.

---

## 9. Peripheral Features

### 9.1 Personalized Food Recommendation (Claims 2, 7, 10)
- **Mechanism:** Hybrid 60% collaborative filtering + 40% content-based filtering on user ordering history and similar-user patterns; previously ordered items excluded
- **Disclosure:** [0066], [0101]; FIG. 2 Steps 202–208
- **Status:** Dependent on Claims 1 and 6 respectively; optional module

### 9.2 Email Notification System (Claims 3, 8)
- **Mechanism:** Notification Module (180) triggers emails on 5 event types (recharge approval, recharge disapproval, order acceptance, order rejection, order readiness)
- **Performance:** ~98–99% delivery success, under 5 seconds [0099]
- **Disclosure:** [0068], [0069], [0099]; FIG. 2 Steps 210–214
- **Status:** Dependent on Claims 1–2 and 6–7; optional module

### 9.3 Administrator Interface (Claim 4)
- **Mechanism:** Centralized module to register entities (name/address/contact/email/password), create staff accounts, configure system settings, edit/delete entities
- **Disclosure:** [0095]; Claim 4
- **Status:** Dependent; administrative enablement layer

### 9.4 Wallet Insufficiency Check and Prevention (Claim 5)
- **Mechanism:** Pre-order comparison of wallet balance against order amount; blocking placement if insufficient; displaying an insufficient balance message to user
- **Disclosure:** [0081], [0088]–[0092]; FIG. 3 Decision 314; FIG. 4 Steps 408–416
- **Status:** Dependent (Claim 5); financial integrity enforcement

### 9.5 Digital Kitchen-Facing Interface
- **Mechanism:** Accepted orders are digitally transmitted to a kitchen display; kitchen staff manage multiple orders simultaneously; orders visible after marking ready until manually removed
- **Disclosure:** [0093], [0094], [0102]
- **Status:** Specification only — not recited in any claim

### 9.6 Staff Menu Management
- **Mechanism:** Staff upload food items (name, image, ingredients, quantity, price, type); can enable/disable items; quantity=0 marks item unavailable
- **Disclosure:** [0096]
- **Status:** Specification only — not recited in any claim

### 9.7 Performance Metrics (Waiting Time Reduction)
- **Claim:** System reduces waiting time from ~15–20 minutes to ~2–4 minutes (75–85% reduction)
- **Disclosure:** [0098], [0102]
- **Status:** Specification only; stated performance outcome

### 9.8 Staff Interface Login Authentication
- **Mechanism:** Secure email + password authentication for mess staff
- **Disclosure:** [0073]
- **Status:** Specification only — not recited in any claim

### 9.9 Menu Display with Images, Ingredients, Price, and Search
- **Mechanism:** User Interface Module displays food items with associated images, ingredients, and price information; includes search function for food items within the menu
- **Disclosure:** [0074], [0096]
- **Status:** Specification only — not recited in any claim

---

## 10. Technical Feature Graph

```
INPUT
  |
  +- User (120) initiates wallet recharge request (entity ID + amount)
        |
PROCESS
  |
  +- User Interface Module (130) receives and routes recharge request to Server (102)
        |
  +- Staff Interface Module (140) surfaces request to mess staff
        |
DECISION [D1] -- Staff approves?
  |       |
  |       +-- NO  --> State: Wallet unchanged; Process: END
  |       |
  |       +-- YES -->
  |               |
STATE CHANGE [SC1]
  |  Wallet Management Module (150) + Database (104):
  |  wallet_balance[user][entity] += recharge_amount
        |
INPUT
  |
  +- User (120) places food order (one or more items from menu[entity])
        |
PROCESS
  |
  +- Wallet Management Module (150) retrieves wallet_balance[user][entity]
  +- Wallet Management Module (150) calculates total_order_amount
        |
DECISION [D2] -- wallet_balance >= total_order_amount?
  |       |
  |       +-- NO  --> State: Order blocked
  |       |            Output: Insufficient balance message to user
  |       |            END
  |       |
  |       +-- YES -->
  |               |
STATE CHANGE [SC2]
  |  wallet_balance[user][entity] -= total_order_amount  (automatic deduction)
        |
OUTPUT
  |
  +- Order submitted to Order Management Module (160)
  +- Order details transmitted to Kitchen-Facing Interface
        |
NEXT SYSTEM ACTION
  |
  +- Staff Interface Module (140) receives order status change from staff
        |
DECISION [D3] -- Order status = rejection OR cancellation?
  |       |
  |       +-- YES -->
  |       |         |
  |       |   STATE CHANGE [SC3]
  |       |   wallet_balance[user][entity] += total_order_amount  (automatic refund)
  |       |   [Instantaneous; no banking reconciliation delay]
  |       |         |
  |       |   OUTPUT: Notification Module (180) sends email to user (120)
  |       |
  |       +-- NO  --> Order accepted or ready --> Kitchen interface updated
  |                   OUTPUT: Notification Module (180) sends email to user (120)
  |
  +- [Parallel branch from order receipt]
       Recommendation Module (170):
         Step 1: Analyze user ordering history
         Step 2: Identify similar users
         Step 3: Generate recommendations
                 (60% collaborative filtering + 40% content-based filtering)
                 (Exclude previously ordered items)
         Step 4: Surface via User Interface Module (130)

KEY DEPENDENCIES:
  D1 must resolve YES before SC1 (wallet update may occur)
  SC1 completion is prerequisite for meaningful D2 check on new balance
  D2 must resolve YES before SC2 (deduction)
  SC2 must complete before D3 is evaluated
  D3 resolves YES -> SC3 (refund); D3 resolves NO -> order fulfillment path
  Notification (Claim 3) depends on D3 outcome
  Recommendation (Claim 2) runs in parallel from order receipt
```

---

## 11. Reference Patent "Fingerprint"

| ID | Highly Specific Technical Feature | Claim/Para |
|---|---|---|
| **R01** | Server manages a **plurality of food service entities**, each with an **independent menu** | Claim 1 C1.2 |
| **R02** | Database stores a **separate wallet balance per user per food service entity** (not a single global balance) | Claim 1 C1.3 |
| **R03** | User Interface Module receives **wallet recharge requests** specifying **entity ID + recharge amount** | Claim 1 C1.4 |
| **R04** | **Physical payment at mess counter** precedes digital wallet credit; user pays physically first, staff verify second | [0051], [0052], [0073] |
| **R05** | **Staff Interface Module** receives staff input to **approve or disapprove** recharge requests | Claim 1 C1.5 |
| **R06** | Wallet balance update is **conditional on staff approval** — no update on disapproval | Claim 1 C1.6; FIG. 1 Decision 106 |
| **R07** | **Automatic deduction** of order amount from wallet balance **at moment of order placement** (no additional user action) | Claim 1 C1.6; Claim 6 C6.6 |
| **R08** | **Staff-driven order status change** (accept / reject / mark as ready) through Staff Interface Module | Claim 1 C1.7; Claim 6 C6.7 |
| **R09** | **Automatic instantaneous refund** to wallet balance triggered by order rejection or cancellation (within seconds; no 2–10 working day banking delay) | Claim 1 C1.6; Claim 6 C6.8 |
| **R10** | **Pre-order wallet sufficiency check**: compare entity-scoped balance against total order amount before allowing placement | Claim 5; FIG. 4 Decision 408 |
| **R11** | **Order placement prevention** + **insufficient balance message** displayed to user when balance is insufficient | Claim 5; FIG. 4 Steps 412, 416 |
| **R12** | Recommendation Module: **60% collaborative filtering + 40% content-based filtering** hybrid algorithm | [0066] |
| **R13** | Recommendations **exclude previously ordered items** — only suggest untried food items | [0066] |
| **R14** | **Five notification event types** by email: recharge approval, recharge disapproval, order acceptance, order rejection, order readiness | Claim 3 C3.3 |
| **R15** | **Administrator Interface Module** registers entities with: mess name, owner name, address, contact, email, password | [0095], Claim 4 |
| **R16** | Administrator can **edit and delete** registered food service entities from the centralized platform | [0095] |
| **R17** | **Kitchen-facing interface**: accepted orders digitally transmitted; kitchen staff manage multiple orders simultaneously; orders removable manually after ready | [0093], [0094] |
| **R18** | Staff **enable/disable food items**; quantity=0 marks item unavailable on menu | [0096] |
| **R19** | **No external payment gateway** integration required; operates entirely on physical payment + staff verification | [0009], [0013], [0102] |
| **R20** | Three independent claim types: **system** (Claim 1), **method** (Claim 6), **non-transitory computer-readable medium** (Claim 9) | Claims 1, 6, 9 |

---

## 12. Evidence Table

| Feature | Exact Evidence Location |
|---|---|
| Title, applicant, agent | Lines 1–44 of specification; Drawings document header |
| Filing date | "Dated This 19th day of February 2026" — spec p.24, claims p.27, abstract p.28 |
| Digital signature date | "Date: 08-Mar-2026 15:04:57" — specification p.1 |
| No priority claim | [0001] |
| Field of invention | [0003] |
| Prior art — Scifo et al. (US20090204492A1) | [0005] |
| Prior art — Ryan et al. (US20210366586A1) | [0006] |
| Prior art — KR20240026603A (recommendation system) | [0007] |
| Prior art — US20210158323A1, US20200265506A1, US20190279272A1 | [0008] |
| Four stated technical problems | [0009] |
| Object of invention (per-entity wallet, staff verify, auto deduct/refund) | [0013] |
| System summary — Aspect 1 (components) | [0016] |
| Method summary — Aspect 2 | [0026] |
| Computer-readable medium — Aspect 3 | [0032] |
| FIG. 1 brief description | [0039] |
| FIG. 2 brief description | [0040] |
| FIG. 3 brief description | [0041] |
| FIG. 4 brief description | [0042] |
| Server (102) receives recharge request | [0051]; FIG. 1 Step 102; FIG. 3 Step 302 |
| Physical payment at mess counter (staff verify) | [0052], [0073], [0075] |
| Wallet balance unchanged if disapproved | [0054]; FIG. 1 Step 108 |
| Wallet balance updated on approval | [0055]; FIG. 1 Step 110; FIG. 3 Step 310 |
| Food order received from user | [0056]; FIG. 1 Step 112; FIG. 3 Step 312 |
| Automatic deduction on placement | [0057]; FIG. 1 Step 114; FIG. 4 Step 410 |
| Staff order status change received | [0058]; FIG. 1 Step 116; FIG. 2 Step 210 |
| Automatic refund on rejection/cancellation | [0060]; FIG. 1 Steps 118–120 |
| Refund instantaneous vs. 2–10 day banking delay | [0060], [0027] |
| Recommendation module — method (steps 202–208) | [0064]–[0066]; FIG. 2 Steps 202–208 |
| 60%/40% hybrid algorithm | [0066] |
| Exclusion of previously ordered items | [0066] |
| Notification module — 5 event types | [0068]–[0069]; FIG. 2 Step 214 |
| Claim 3 notification scope (5 types) vs. Claim 8 (3 types) | Claim 3 C3.3; Claim 8 C8.3 |
| System module architecture (all 6 modules) | [0072]; FIG. 3 |
| User registration and entity selection | [0073] |
| Staff login (email + password) | [0073] |
| Menu display (images, ingredients, price, search) | [0074], [0096] |
| Wallet sufficiency check | [0081]; FIG. 3 Decision 314; FIG. 4 Decision 408 |
| Order prevention for insufficient balance | [0081], [0091]; FIG. 4 Step 412 |
| Insufficient balance message to user | [0092]; FIG. 4 Step 416 |
| Kitchen-facing interface (digital transmission) | [0093] |
| Orders remain on kitchen interface until manual removal | [0094] |
| Administrator module — entity registration fields | [0095] |
| Staff menu management — upload, enable/disable, quantity | [0096] |
| Profile management (users and staff) | [0097] |
| Waiting time reduction (15–20 min → 2–4 min, 75–85%) | [0098], [0102] |
| Email delivery: 98–99% success, under 5 seconds | [0099] |
| Non-transitory computer-readable medium | [0100]; Claims 9, 10 |
| Six stated technical advantages | [0102] |
| Claim 1 (Independent system claim) | Spec lines 834–851 |
| Claim 2 (Recommendation module — system) | Spec lines 852–855 |
| Claim 3 (Notification module, 5 event types — system) | Spec lines 856–860 |
| Claim 4 (Administrator interface — system) | Spec lines 861–868 |
| Claim 5 (Balance insufficiency prevention — system) | Spec lines 869–872 |
| Claim 6 (Independent method claim) | Spec lines 873–887 |
| Claim 7 (Method + recommendations) | Spec lines 888–890 |
| Claim 8 (Method + notifications, 3 event types) | Spec lines 891–894 |
| Claim 9 (Non-transitory medium — independent) | Spec lines 895–897 |
| Claim 10 (Medium + recommendations) | Spec lines 902–905 |
| Abstract | Spec lines 918–930 |
| FIG. 1 drawing steps | Drawings doc, FIG. 1 section |
| FIG. 2 drawing steps | Drawings doc, FIG. 2 section |
| FIG. 3 drawing steps + module list | Drawings doc, FIG. 3 section |
| FIG. 4 drawing steps | Drawings doc, FIG. 4 section |
| Drawing fingerprint D01–D20 | Drawings doc, "Technical Feature Fingerprint From Drawings" section |

---

> **END OF REFERENCE BASELINE**
