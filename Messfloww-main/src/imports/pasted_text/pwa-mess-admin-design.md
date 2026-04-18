Design a modern, high-performance admin dashboard for a Progressive Web App (PWA) used in a college mess ordering system. The interface must prioritize speed, clarity, and real-time usability for handling 300–400 orders per hour.

Use this color palette consistently:

* Background / base: #362F4F
* Primary action: #5B23FF
* Secondary action / hover: #008BFF
* Highlight / success: #E4FF30

Typography: Inter or similar sans-serif, high readability, bold headings, medium labels.

Style:

* Minimal, grid-based layout
* Rounded corners (12–16px)
* Soft shadows
* High contrast
* Large touch-friendly buttons

---

Create the following screens:

1. Login Screen

* Centered layout
* Large “Sign in with Google” button
* Text: “Only @vitstudent.ac.in allowed”

---

2. Main Dashboard Layout

* Left sidebar (collapsible):
  Dashboard, Orders, Students, Menu, Time Slots, Printers, Ledger, Settings
* Top bar:
  Current time slot (highlighted), active orders count, admin profile

---

3. Live Orders Dashboard (core screen)

* Responsive grid of order cards

Each card must include:

* Order ID (bold)
* Student name / ID
* Items list
* Time
* Amount

Status indicators (very clear):

* KOT Status:
  blank (not printed), green tick (printed), red X (failed after slot)
* Pickup Status:
  blank (not scanned), green tick (completed), red X (not collected)

Use strong visual hierarchy and color coding. Keep it instantly scannable.

---

4. Barcode Scan Screen (Mess Counter)

* Large central scan area
* Text: “Scan barcode to complete order”
* On success:
  show order details + green success feedback
* Optional “Print Receipt” button

---

5. External / Shop Order Screen

* POS-style layout
* Grid of items (large buttons)
* Cart section with total
* Primary button: “Place Order & Print KOT”

---

6. Student Management Screen

* Table:
  Email, Reg No, Balance, Status
* Actions:
  Edit balance, Enable/Disable toggle
* Top buttons:
  Upload CSV, Assign Monthly Balance

---

7. Menu Management Screen

* Tabs: Breakfast, Lunch, Snacks, Dinner, Night
* Item cards:
  Name, Price, Availability toggle
* Add/Edit item modal

---

8. Time Slot Management

* List of slots with time ranges
* Editable inputs
* Highlight current active slot

---

9. Printer & KOT Settings

* Device cards:
  Device name, Counter type (Mess / External / Shop), Assigned printer
* Toggles:
  Auto KOT Printing
  Receipt Printing on Scan
* Active states clearly highlighted

---

10. Order Ledger / History

* Table with filters:
  Date range, Meal type
* Columns:
  Order ID, Student, Items, Time, Amount, Status
* Expandable rows for details

---

Interaction rules:

* Primary buttons use #5B23FF
* Hover states use #008BFF
* Success indicators use #E4FF30 + green tick
* Error states use red X
* Keep all actions within 1–2 clicks

---

Focus on:

* Speed of use
* Clear status visibility
* Real-time feel
* Minimal cognitive load

Design for desktop first, but ensure tablet responsiveness.
