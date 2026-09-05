# Example Patent — Drawings and Figure Descriptions

## Document Information

- **Applicant:** VELLORE INSTITUTE OF TECHNOLOGY
- **Inventor/Named Person:** Kuldeep Singh
- **Authorized Agent:** Indian Patent Agent
- **Agent Registration No.:** IN/PA-4358
- **Application No.:** Not specified in the drawings
- **Number of Figures:** 4

> This Markdown document is a structured textual representation of the uploaded patent drawing sheets. It preserves the figure numbering, workflow steps, component labels, and relationships shown in the drawings.

---

# FIG. 1 — Wallet Recharge and Food Order Workflow

**Figure reference:** 1/4

## Workflow 100

1. **Step 102 — Receive wallet recharge request**
   - Receive wallet recharge request from user specifying:
     - food service entity
     - recharge amount

2. **Step 104 — Receive staff input**
   - Receive staff input indicating approval or disapproval of the recharge request.

3. **Decision 106 — Is recharge request approved?**
   - **No → Step 108:** End recharge; recharge is disapproved.
   - **Yes → Step 110:** Update wallet balance associated with the user and food service entity.

4. **Step 112 — Receive food order**
   - Receive food order from user for the food service entity.

5. **Step 114 — Automatically deduct order amount**
   - Automatically deduct the order amount from the wallet balance.

6. **Step 116 — Receive staff order-status input**
   - Receive staff input indicating a change in order status.

7. **Decision 118 — Is order status rejection or cancellation?**
   - **Yes → Step 120:** Automatically refund the deducted amount to the wallet balance.
   - **No → Step 122:** Process the order as accepted or ready.

## Figure 1 Technical Flow

```text
Wallet Recharge Request
        ↓
Staff Approval / Disapproval
        ↓
   Approved?
   /        No         Yes
 ↓           ↓
End       Update Wallet
              ↓
        Receive Food Order
              ↓
       Deduct Order Amount
              ↓
       Receive Order Status
              ↓
   Rejected / Cancelled?
       /                  Yes              No
      ↓                ↓
Automatic Refund   Process Order
```

---

# FIG. 2 — Personalized Food Recommendation and Notification Workflow

**Figure reference:** 2/4

## Workflow 200

1. **Step 202 — Receive food order**
   - Receive food order from user.

2. **Step 204 — Analyze ordering history**
   - Analyze the user's ordering history.

3. **Step 206 — Identify similar users**
   - Identify other users with similar ordering behaviour.

4. **Step 208 — Generate personalized recommendations**
   - Generate personalized food item recommendations.

5. **Step 210 — Receive order-status change**
   - Receive a change in order status from staff.

6. **Decision 212 — Is order accepted, rejected, or ready?**
   - **Yes → Step 214:** Transmit email notification to the user based on the order status.
   - **No → Step 216:** End; no notification required.

## Figure 2 Technical Flow

```text
Receive Food Order
        ↓
Analyze Ordering History
        ↓
Identify Users With Similar Behaviour
        ↓
Generate Personalized Food Recommendations
        ↓
Receive Order Status Change
        ↓
Accepted / Rejected / Ready?
        /                       Yes                  No
       ↓                    ↓
Email Notification       End
```

---

# FIG. 3 — System Module Interaction

**Figure reference:** 3/4

## Workflow 300

1. **Step 302 — User interface module**
   - User interface module receives a wallet recharge request.

2. **Step 304 — Staff interface module**
   - Staff interface module receives staff approval input.

3. **Decision 306 — Is recharge approved by staff?**
   - **No → Step 308:** Recharge request rejected.
   - **Yes → Step 310:** Wallet management module updates wallet balance.

4. **Step 312 — User interface module**
   - User interface module receives food order.

5. **Decision 314 — Is wallet balance sufficient?**
   - **Yes → Step 318:** Wallet management module deducts the order amount.
   - **No → Step 316:** Order placement prevented.

6. **Step 320 — Order management module**
   - Order management module processes order status.

## Modules Identified

### User Interface Module
Receives user-side inputs including:
- wallet recharge request
- food order

### Staff Interface Module
Receives staff approval input for wallet recharge.

### Wallet Management Module
Performs:
- wallet balance update
- order amount deduction

### Order Management Module
Processes:
- order status

## Figure 3 Module Flow

```text
User Interface Module
        ↓
Wallet Recharge Request
        ↓
Staff Interface Module
        ↓
Staff Approval
        ↓
    Approved?
    /         No         Yes
  ↓           ↓
Reject    Wallet Management
              ↓
       Update Wallet Balance
              ↓
       User Interface Module
              ↓
          Food Order
              ↓
       Wallet Balance Sufficient?
          /                      No                Yes
        ↓                  ↓
Prevent Order       Deduct Amount
                           ↓
                  Order Management
                           ↓
                    Process Status
```

---

# FIG. 4 — Wallet Sufficiency and Order Placement

**Figure reference:** 4/4

## Workflow 400

1. **Step 402 — Receive food order request**
   - Receive food order request from user.

2. **Step 404 — Retrieve wallet balance**
   - Retrieve wallet balance corresponding to the food service entity.

3. **Step 406 — Calculate total order amount**
   - Calculate the total amount of the order.

4. **Decision 408 — Is wallet balance sufficient?**
   - **Yes → Step 410:** Proceed with order placement and deduct order amount.
   - **No → Step 412:** Prevent order placement and notify user.

5. **Step 414 — Submit order**
   - Submit the order to the order management module.

6. **Step 416 — Insufficient balance message**
   - Display an insufficient balance message to the user.

## Figure 4 Technical Flow

```text
Receive Food Order Request
        ↓
Retrieve Wallet Balance
        ↓
Calculate Total Order Amount
        ↓
    Balance Sufficient?
       /               Yes           No
      ↓             ↓
Proceed &        Prevent Order
Deduct Amount       ↓
      ↓         Notify User
Submit Order        ↓
to Order        Insufficient
Management         Balance
Module             Message
```

---

# Consolidated Figure Comparison

| Figure | Primary Function | Main Technical Components / Operations |
|---|---|---|
| **Fig. 1** | Wallet recharge, payment deduction, refund, order status | Recharge request, staff approval, wallet update, order deduction, refund |
| **Fig. 2** | Personalized recommendation and notification | Ordering history analysis, similar-user identification, recommendations, email notification |
| **Fig. 3** | Modular system representation | User interface, staff interface, wallet management, order management |
| **Fig. 4** | Wallet sufficiency validation | Wallet retrieval, order amount calculation, balance check, order prevention/submission |

---

# Technical Feature Fingerprint From Drawings

The drawings collectively show the following identifiable mechanisms:

- **D01:** User-initiated wallet recharge request tied to a food service entity.
- **D02:** Staff approval/disapproval of recharge requests.
- **D03:** Wallet balance update after approval.
- **D04:** Food order associated with the food service entity.
- **D05:** Automatic deduction of order amount from wallet balance.
- **D06:** Staff-controlled order-status update.
- **D07:** Automatic refund following rejection or cancellation.
- **D08:** Analysis of user ordering history.
- **D09:** Identification of users with similar ordering behaviour.
- **D10:** Generation of personalized food recommendations.
- **D11:** Email notification based on order status.
- **D12:** Separate user interface and staff interface modules.
- **D13:** Wallet management module.
- **D14:** Order management module.
- **D15:** Wallet sufficiency check before order placement.
- **D16:** Prevention of order placement when balance is insufficient.
- **D17:** Retrieval of wallet balance corresponding to a food service entity.
- **D18:** Calculation of total order amount.
- **D19:** Submission of accepted orders to an order management module.
- **D20:** Display/notification of insufficient balance.

---

# Drawing-to-Workflow Relationship

The four figures can be viewed as different representations or extensions of the same general system:

```text
FIG. 1
End-to-end wallet + ordering workflow
        │
        ├───────────────┐
        ↓               ↓
FIG. 2              FIG. 3
Recommendation      Module architecture
+ notification      + wallet/order modules
        │               │
        └───────┬───────┘
                ↓
             FIG. 4
        Wallet sufficiency
        + order placement
```

## Important Observation for Later Novelty Analysis

This document records what is visibly represented in the drawings only.

The fact that a feature appears in these drawings means it is part of the reference patent's disclosed drawing set; it does **not**, by itself, establish the legal scope of the patent claims or establish whether any feature is novel.

For novelty comparison, the drawing features should later be cross-referenced against:
- the complete patent specification,
- the claims,
- the relevant dates, and
- independent prior-art references.

---

**END OF DRAWINGS REFERENCE**
