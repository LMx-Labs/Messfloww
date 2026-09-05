                               FORM-2


                      THE PATENTS ACT, 1970
                              (39 of 1970)
                                 &
                    THE PATENTS RULES, 2003


                             COMPLETE
                          SPECIFICATION
                    (See section 10 and rule 13)


                       TITLE OF INVENTION


         DISTRIBUTED DUAL-DATABASE FOOD ORDERING SYSTEM
         WITH TRANSPORT-LAYER KILL-SWITCH AND AUTOMATED
         DEADLOCK RESOLUTION FOR HIGH-CONCURRENCY
                CAMPUS ENVIRONMENTS


                APPLICANT NAME AND ADDRESS


                     Vellore Institute of Technology
               An Indian University having address as:
                   Vellore Campus, Vellore - 632 014
                           Tamil Nadu, India


     THE FOLLOWING SPECIFICATION PARTICULARLY DESCRIBES
    THE INVENTION AND THE MANNER IN WHICH IT IS TO BE
                            PERFORMED
     CROSS-REFERENCE TO RELATED APPLICATIONS AND PRIORITY
     [0001]         The present application does not claim priority from any patent
     application.
     PREAMBLE
     [0002]         The following specification particularly describes the invention and the
     manner in which it is to be performed.
                                     FIELD OF INVENTION
     [0003]         The present disclosure relates to distributed food ordering and
     management systems, and more particularly to a distributed dual-database food
     ordering system that orchestrates synchronous compensating transactions across
     a document database and a real-time database for concurrent stock and ledger
     coherence, with a transport-layer administrative kill-switch and automated
     chronological deadlock resolution for high-concurrency campus environments.
                                         BACKGROUND
     [0004]         The following text of background art is provided for purposes of
     understanding and is not an admission that any cited document or technique forms
     part of the prior art under applicable law.
     [0005]         Web-based food ordering systems with wallet mechanisms are known.
     Reference is made to the wallet-based multi-entity food ordering system
     disclosing a server managing a plurality of food service entities each with an
     independent menu, a database storing separate wallet balances per user per
     entity, staff-verified recharge approval, automatic deduction on order placement,
     automatic refund on rejection or cancellation, and staff-driven order status
     management. Such systems assume unlimited service capacity and disclose no
     stock limitation, no concurrency control, no inventory depletion handling, no
     transport-layer presence control, and no time-based stale-order reclamation.
     The present invention is distinguished by integrating physical stock constraints
     directly into the financial transaction orchestration layer.
     [0006]         Distributed transaction theory is known. Garcia-Molina & Salem,
     “Sagas” (ACM SIGMOD Record, 1987) discloses long-lived transactions using
     compensating transactions to amend partial failures in distributed systems by
     executing a sequence of sub-transactions and, upon failure, executing
     compensating transactions in reverse order. While Sagas teach the logical
     control flow of compensating arrays, they do not teach synchronous single-
     invocation orchestration across a document database and a real-time database
     using optimistic concurrency control within a serverless function for food
     ordering, nor tight coupling of high-frequency stock locking with ACID ledger
     settlement.
     [0007]         Cloud database platform documentation is known. Firebase
     documentation teaches use of Cloud Firestore for persistent ACID document
     storage and querying, and Realtime Database (RTDB) for high-frequency
     low-latency synchronized state such as counters and presence. Firebase
     documentation further teaches the `onDisconnect()` hook for presence systems
     wherein a server-side write is pre-registered and executed by the Firebase
     server upon detection of client WebSocket / TCP closure, commonly for
     chat “online/offline” indicators. Firebase documentation does not teach
     using `onDisconnect` as a hard application-layer precondition blocking
     financial order-entry APIs globally, nor tightly-coupled synchronous
     compensating orchestration between Firestore and RTDB for atomic
     stock-and-wallet coherence.
     [0008]         E-commerce cart expiration using scheduled sweeps is known.
     Generic systems periodically scan pending orders and expire records older
     than a threshold, reverting held inventory. Such generic sweeps do not teach
     resolution of human-in-the-loop physical payment verification deadlocks
     where stock is locked by unverified Unified Payments Interface (UPI) orders
     awaiting physical staff verification, combined with per-item RTDB optimistic
     concurrency increment restoration and archival to a historical store feeding
     a live fan-in menu merge.
     [0009]         Existing food ordering and payment systems present several technical
     challenges in high-density campus mess environments. First, document databases
     alone cannot sustain high-frequency concurrent stock writes at meal-time bursts,
     while real-time databases alone cannot provide rich ACID ledger querying for
     financial audit. Second, concurrent orders for the last unit of limited stock
     cause overselling without optimistic concurrency control. Third, aggressive
     stock locking combined with human-verified physical payments creates
     deadlocks when users abandon payment, holding stock indefinitely. Fourth,
     administrative terminal disconnection without graceful shutdown permits
     orders that the kitchen cannot receive. Fifth, client-submitted prices are
     susceptible to browser manipulation.
     [0010]      It has been appreciated that a system and method is needed that
     overcomes one or more of these problems.
     [0011]      The present invention addresses the above shortcomings. However,
     the invention is entirely different in terms of novelty and technological
     advancements.
     OBJECT
     [0012]      In view of the foregoing, and without prejudice to the generality of the
     disclosure, it is an object of the present invention to provide. It is to be understood
     that the foregoing objects are illustrative and non-limiting; additional objects will
     be apparent from the description, examples, and claims, and need not be achieved
     in every embodiment.
     [0013]      The object of the present disclosure is to provide a distributed
     dual-database food ordering system that guarantees stock-and-ledger coherence
     across un-linkable data stores without a distributed lock manager. The system
     aims to execute synchronous three-phase orchestration within a single serverless
     invocation: document-database validation, real-time-database sequential
     optimistic concurrency stock locking with compensating rollback arrays, and
     document-database financial settlement. Further, the system seeks to provide
     a transport-layer administrative kill-switch wherein physical severing of an
     administrative network connection automatically blocks all order-entry APIs
     without client computation. Additionally, the system seeks to provide automated
     chronological deadlock resolution for abandoned human-verified payments,
     server-side price anti-spoofing, idempotent QR redemption, category-based
     kitchen ticket routing, and dual-subscription live menu merging. By integrating
     these features, the system aims to prevent overselling under burst concurrency,
     release deadlocked inventory, and halt ordering upon kitchen disconnection.
     [0014]      For the avoidance of doubt, the foregoing objects encompass
     compositions and manufacturing processes suitable for adoption in jurisdictions
     where claims to methods of treatment of animals may be restricted; corresponding
     “use” or “product” claim formats are contemplated without limitation.
                                         SUMMARY
     [0015]      The following summary is intended to introduce aspects of the present
     invention in a simplified form and does not identify all the features or the scope of
     the claimed invention. The summary is provided to assist in understanding the
     invention and is to be read in conjunction with the detailed description and
     accompanying drawings, claims, and abstract. One or more embodiments of the
     present disclosure are set forth below solely for illustrative purposes and should not
     be construed as limiting.
     [0016]      In a first aspect, a distributed food ordering system is provided.
     The system comprises a document database configured to store user identity,
     wallet balances, and an immutable financial ledger; a real-time database
     configured to store live inventory counts and active orders; a serverless
     order orchestrator configured to (a) validate identity and balance via a first
     document-database transaction, (b) sequentially execute real-time-database
     optimistic concurrency transactions per cart item to decrement stock,
     accumulating committed items into a compensating array, and executing
     compensating increment transactions over said array upon any per-item
     failure, and (c) deduct wallet balance and write a ledger entry via a second
     document-database transaction only upon success of all stock transactions,
     and to create a real-time-database active order record; wherein stock
     decrement and wallet deduction are thereby held coherent across
     non-transactionally-linkable data stores within a single serverless invocation.
     [0017]      The system architecture provides several technical advantages. By
     separating high-frequency stock mutation (real-time database) from ACID
     financial persistence (document database) yet coupling them synchronously
     with compensating rollbacks, the system prevents overselling under
     simultaneous burst orders without pessimistic locks or two-phase commit.
     The compensating array ensures all-or-none semantics: partial stock success
     is forcibly reverted before returning to the client, unlike eventual-
     consistency saga implementations using asynchronous queues.
     [0018]      The system may further comprise a transport-layer kill-switch module
     configured to pre-register a server-side state-mutation hook on a global
     configuration node, wherein network transport-layer disconnection of an
     administrative client triggers server-side execution of said hook to set said
     node to a blocking state, and wherein all order-entry endpoints validate said
     node as a precondition and reject order creation when in blocking state.
     [0019]      The kill-switch module ensures ordering ceases immediately upon
     loss of kitchen connectivity even if the administrative device loses power
     or crashes without sending a shutdown command. Because execution is
     server-side on socket timeout, no client computation at disconnect time is
     required, distinguishing it from manual toggle switches or UI-only presence
     indicators.
     [0020]      The system may further comprise a chronological sweep module
     configured to periodically poll active orders on a scheduler, filter orders by
     a human-verification flag indicating pending physical payment and a
     time-delta exceeding a threshold, and for each matching order execute a
     real-time-database increment transaction to restore stock, write an archival
     record to a historical store, and delete the active order record.
     [0021]      The chronological sweep module resolves deadlocks created by
     aggressive stock locking combined with human-in-loop UPI verification.
     Unlike manual staff rejection, the sweep is triggered by absence of human
     input over time, releasing deadlocked inventory back to the live menu pool.
     [0022]      The system may further comprise a price anti-spoofing module
     configured to cache document-database menu prices with a time-to-live,
     recompute a server total from cart item identifiers and quantities, and reject
     the order when absolute difference from a client-submitted total exceeds a
     tolerance.
     [0023]      The system may further comprise an idempotent redemption module
     configured to execute a real-time-database check-and-set transaction on an
     order collection flag, setting said flag and a collection timestamp atomically
     and rejecting duplicate scans.
     [0024]      The system may further comprise a category-based routing module
     configured to resolve per-item food categories, match counters by category,
     and write per-counter ticket queue entries, and a live menu merge module
     configured to maintain dual subscriptions to said document database and
     said real-time database and overlay live stock and availability onto
     canonical menu metadata on either update.
     [0025]      In a second aspect, a computer-implemented method for distributed
     atomic order placement is provided. The method comprises validating identity
     and balance in a document-database transaction; sequentially decrementing
     stock via real-time-database optimistic concurrency transactions with
     compensating-array accumulation and rollback; deducting wallet balance via
     a second document-database transaction; and creating said active order only
     upon success of all preceding phases.
     [0026]      The method may further comprise pre-registering said server-side
     hook, executing said hook on transport disconnection, and validating said
     global node before order creation; and periodically sweeping stale pending-
     payment orders to restore stock and archive records.
     [0027]      In a third aspect, a non-transitory computer-readable medium storing
     instructions that, when executed by one or more processors, cause the one or
     more processors to perform the method of the second aspect is provided.
     [0028]      The foregoing general description of the illustrative embodiments and
     the following detailed description thereof are merely exemplary aspects of the
     teachings of this disclosure and are not restrictive.
                            BRIEF DESCRIPTION OF FIGURES
     [0029]      The drawings appended herein illustrate exemplary embodiments of the
     present invention and are provided to enhance understanding of the inventive
     features disclosed. These figures, when read in conjunction with the detailed
     description, depict the operational flow, component architecture, and other
     mechanisms.
     [0030]      The illustrations are schematic in nature and serve solely to clarify the
     principles and functionality of the present disclosure. While particular constructions
     and configurations are depicted for explanatory purposes, it will be understood that
     the invention is not limited to the precise implementations shown in the figures and
     may encompass variations without departing from the scope of protection.
     [0031]      FIG. 1 illustrates a flowchart for synchronous dual-database
     compensating transaction orchestration for order placement, according to aspects
     of the present disclosure.
     [0032]      FIG. 2 illustrates a flowchart for transport-layer kill-switch
     registration and enforcement, according to an embodiment.
     [0033]      FIG. 3 illustrates a flowchart for chronological sweep deadlock
     resolution for abandoned human-verified payments, according to aspects of the
     present disclosure.
     [0034]      FIG. 4 illustrates a flowchart for server-side price validation,
     idempotent QR redemption, and live menu fan-in merge, according to an
     embodiment.
     [0035]      Furthermore, in terms of the construction of the system, one or more
     components of the device may have been represented in the figures by conventional
     symbols, and the figures may show only those specific details that are pertinent to
     understanding the embodiments of the present invention so as not to obscure the
     figures with details that will be readily apparent to those of ordinary skill in the art
     having benefit of the description herein.
                                 DETAILED DESCRIPTION
     [0036]      The following detailed description is intended to provide an in-depth
     understanding of the invention and its various components, configurations, and
     operational aspects. While specific embodiments are described with reference to
     the accompanying drawings, the invention is not limited to the particular forms
     disclosed herein. The scope of the invention shall be interpreted broadly and in
     accordance with the claims appended hereto.
     [0037]      The terms “comprises,” “comprising,” “includes,” “including,” and
     similar expressions used in this description are intended to be open-ended and
     should be interpreted to include, but not be limited to, the mentioned elements.
     Unless explicitly stated otherwise, singular terms may include their plural
     equivalents and vice versa, depending on the context in which they appear.
     [0038]      Reference is now made to the accompanying figures, which illustrate
     example embodiments of the present invention. It should be appreciated that the
     figures are intended for illustration and explanatory purposes only and do not limit
     the scope of the invention. Similar reference numerals have been used to denote
     functionally similar components throughout the figures.
     [0039]      The embodiments described herein are presented for illustrative
     purposes and are subject to variations, modifications, and adaptations by those
     skilled in the art. Any equivalent implementations that perform substantially the
     same function in substantially the same manner are intended to fall within the scope
     of this disclosure and the claims appended hereto.
     [0040]      The use of the term “exemplary” in the description shall be understood
     to mean “serving as an example or illustration” and shall not be construed as
     limiting the invention to the preferred embodiments disclosed.
     [0041]      Embodiments of the disclosure are described in the following paragraphs
     with reference to Figures. In Figures, the same elements or elements that have the
     same functions are indicated by the same reference signs.
     [0042]      The present invention will now be described in detail with reference to
     the accompanying drawings illustrating exemplary embodiments.
     [0043]      FIG. 1 illustrates a flowchart for a method 100 for synchronous
     dual-database compensating orchestration according to various embodiments.
     [0044]      The method 100 operates within a system 10 comprising a document
     database 12 (exemplarily Cloud Firestore storing `users/{uid}`,
     `students/{regNo}`, `menu`, `ledger/{id}`, `orderCounters/{date}`,
     `historical_orders/{id}`) and a real-time database 14 (exemplarily Firebase
     RTDB storing `active_orders/{orderId}`, `menu_stock/{itemId}`,
     `kot_queue/{counterId}`, `system_status/admin_online`). The databases are
     non-transactionally-linkable; no single two-phase commit spans both stores.
     [0045]      The method 100 begins with a step 102, where a serverless function
     16 (exemplarily `securePlaceOrder`) receives an order request comprising
     cart item identifiers, quantities, client-computed total, slot identifier, and
     payment mode. At step 104, a price anti-spoofing sub-module loads cached
     menu prices into a module-level map with 5-minute TTL, recomputes
     serverTotal, and rejects when |clientTotal - serverTotal| > 1.
     [0046]      The method 100 proceeds to a step 106, where said function executes
     a first document-database transaction reading `users/{uid}` to resolve
     registration number, reading `students/{regNo}` for balance and status, and
     reading-incrementing `orderCounters/{today}` to allocate a daily sequential
     token. If status is disabled or balance is insufficient, the method aborts.
     [0047]      The method 100 then moves to steps 108-114, where for each cart
     item sequentially, said function executes a real-time-database optimistic
     concurrency transaction (`runTransaction`) on `menu_stock/{itemId}`: if
     current stock >= requested quantity, decrement stock and, if stock <=
     minStock, set available=false; else abort said per-item transaction. Upon
     commit, a reference to said item is appended to a compensating array
     `stockReverts[]`. At decision 110, if any per-item transaction aborts, the
     method proceeds to step 112 executing compensating increment transactions
     over all entries in `stockReverts[]`, then terminates with
     resource-exhausted error without creating any order or deducting wallet.
     [0048]      If all per-item transactions succeed at decision 110, the method
     proceeds to step 116, where said function executes a second document-
     database transaction deducting `students/{regNo}.balance` and synchronizing
     `users/{uid}.walletBalance`, writing `ledger/{id}` with server timestamp,
     and creating `active_orders/{orderId}` in said real-time database with a
     cryptographically generated identifier (`MFW-` + CSPRNG UUID segment),
     daily token, estimated serving window, and payment status. In an embodiment
     where said second transaction fails after stock success, compensating
     increment transactions over `stockReverts[]` are executed to restore stock
     prior to returning error, preserving cross-store coherence.
     [0049]      Steps 106-116 execute synchronously within said single serverless
     invocation before any success response is returned to the client, thereby
     providing pseudo-distributed-atomicity without asynchronous queues or
     eventual consistency. This tightly-coupled synchronous coupling is distinct
     from generic asynchronous saga implementations.
     [0050]      FIG. 2 illustrates a flowchart for a method 200 for transport-layer
     kill-switch control according to various embodiments.
     [0051]      The method 200 begins with a step 202, where an administrative
     client registers a heartbeat writing `system_status/admin_online=true` and
     pre-registers `onDisconnect(ref).set(false)` on said node. Said registration
     is stored server-side by the real-time-database infrastructure.
     [0052]      The method 200 proceeds to a step 204 representing a transport event:
     TCP / WebSocket closure or heartbeat timeout of said administrative client,
     whether by graceful close, crash, power loss, or network partition. No
     application-layer shutdown message is required.
     [0053]      The method 200 moves to a step 206, where said infrastructure
     server-side executes said pre-registered write, setting
     `system_status/admin_online=false` without any client computation at
     disconnect time.
     [0054]      The method 200 then moves to a step 208, where each order-entry
     endpoint (`securePlaceOrder`, `securePlaceKioskOrder`, `securePlaceUpiOrder`)
     validates said node as a precondition and rejects creation when false.
     Concurrently at step 210, subscribing clients observe said node via push
     listener and disable order buttons. Ordering is thereby frozen globally until
     reconnection sets said node true. Said flag is thus applied as a hard
     financial-transaction gate, not merely a UI presence indicator.
     [0055]      FIG. 3 illustrates a flowchart for a method 300 for chronological
     deadlock resolution according to various embodiments.
     [0056]      The method 300 begins with a step 302, where a scheduler (exemplarily
     Cloud Scheduler every 5 minutes, Asia/Kolkata) triggers a sweep function
     (exemplarily `cancelStalePendingOrders`). At step 304, said function fetches
     `active_orders` and filters by `paymentStatus==PENDING AND
     createdAt < now - 900000` (15-minute threshold), identifying orders where
     human-in-loop physical UPI verification was initiated but never completed.
     [0057]      The method 300 proceeds to steps 306-310 per matching order: at
     step 306 execute real-time-database increment transactions restoring
     `menu_stock/{itemId}.stock`; at step 308 write `historical_orders/{id}` with
     status expired and cancelReason auto_expired_15min; at step 310 delete
     `active_orders/{id}`. At step 312, restored stock propagates via live-menu
     fan-in merge, optionally re-enabling availability when stock > minStock.
     Said sweep is triggered by absence of human input over time, distinct from
     staff-press rejection triggers.
     [0058]      Human-in-loop verification itself is performed at step 314 via
     `confirmAndCollectUpiOrder`: a real-time-database transaction checking
     `paymentStatus==PENDING AND qrUsed != true` and atomically setting
     `paymentStatus=PAID, qrUsed=true, status=processing, paidAt, scannedAt`
     upon staff press of Payment Verified after physical verification. If said
     verification never occurs, said sweep at steps 306-310 resolves the
     consequent stock deadlock.
     [0059]      FIG. 4 illustrates a flowchart for a method 400 for auxiliary
     integrity mechanisms according to an embodiment.
     [0060]      The method 400 begins with steps 402-404 for idempotent redemption:
     at step 402 receive orderId from QR scan (global keydown buffer with 100ms
     debounce for HID scanners, or camera scan); at step 404 execute
     real-time-database transaction reading `active_orders/{orderId}`; if
     `qrUsed==true` throw ORDER_ALREADY_COLLECTED; else atomically set
     `qrUsed=true, status=processing, scannedAt`.
     [0061]      The method 400 continues to steps 406-408 for live menu merging:
     at step 406 maintain dual subscriptions (document-database onSnapshot on
     `menu`; real-time-database onValue on `menu_stock`); at step 408 on either
     update, overlay RTDB stock/minStock/available onto canonical Firestore
     items and push merged payload to clients. Said merge ensures threshold
     toggles (M04) and sweep restorations propagate in sub-second push
     semantics.
     [0062]      The method 400 continues to steps 410-412 for category routing and
     printing: at step 410 group order items by resolved food category and route
     to `kot_queue/{counterId}` per counter category map, with uncategorized
     fallback, deduplicating identical names within a category; at step 412
     attempt POST to local thermal print server (`127.0.0.1:5000/print-kot`
     via win32print with threading lock) serialized via promise chain, falling
     back to iframe browser print on HTTP failure, with failure tracking
     (`status=failed, retryCount<3`) and manual retry trigger.
     [0063]      The system further comprises kiosk multi-mode processing wherein
     said serverless function branches on orderType counter/external/shop with
     distinct prefixes CNT-/EXT-/SHP-, validating student registration only for
     counter mode; dual-path balance synchronization updating both
     `students/{regNo}.balance` and `users/{uid}.walletBalance` in the same
     transaction or batch; daily sequential tokening via `orderCounters/{date}`;
     and write-only ledger convention with no delete path in application code.
     [0064]      There are several technical advantages of the present disclosure.
     First, synchronous cross-store orchestration with compensating arrays
     prevents overselling and ledger-stock divergence under burst concurrency
     without two-phase commit. Second, transport-layer kill-switch provides
     fail-closed safety upon kitchen disconnection without polling. Third,
     chronological sweep provides elastic inventory that is strictly consistent
     at order time but self-healing at 15-minute horizon when physical
     verification fails. Fourth, server-side price recomputation blocks DevTools
     spoofing. Fifth, atomic QR check-and-set prevents double collection. Sixth,
     category routing with local thermal fallback bridges cloud ordering to
     offline kitchen hardware. These collectively address high-burst low-
     reliability campus networks distinctly from unlimited-capacity wallet systems.
     [0065]      It will be appreciated that the above-detailed description, along with
     FIGs, is provided to illustrate the architecture and operation of exemplary
     embodiments of the present invention. Various modifications and enhancements
     can be made without departing from the scope of the invention. All such variations,
     as would be recognized by those skilled in the art, are intended to be within the
     scope of the present disclosure, which is defined by the claims that follow.
     [0066]      It will be appreciated by persons skilled in the art that while the
     invention has been described with reference to specific embodiments and
     accompanying drawings, numerous modifications, substitutions, variations, and
     equivalents are possible without departing from the spirit or scope of the present
     invention. The use of singular terms such as “a,” “an,” and “the” is not intended to
     limit the disclosed elements to a single instance unless explicitly stated, and such
     terms should be interpreted to include plural forms as applicable. Likewise, the
     terms “comprises,” “comprising,” “includes,” “including,” “has,” “having,” and
     their grammatical variants are intended to be open-ended and non-limiting, and
     should be interpreted as meaning “including but not limited to.”
     [0067]      It is further understood that where features, characteristics, or elements
     are described in connection with a Markush group or a disjunctive phrase (e.g., “A
     or B”), the invention includes all possible combinations and sub-combinations
     thereof unless explicitly excluded. Thus, a statement referring to “at least one of A,
     B, and C” should be interpreted to mean any one or more of A, B, and C,
     individually or in any combination.
     [0068]      In interpreting the specification and claims, all terms should be
     construed in the broadest reasonable manner consistent with the context and the
     understanding of those skilled in the art. Moreover, references to “one
     embodiment,” “an embodiment,” or “in certain embodiments” are not meant to
     imply that such features are required or exclusive, and any feature described in
     connection with one embodiment may be used in combination with other features
     or embodiments unless clearly prohibited or contextually inconsistent.
     [0069]      It should be further appreciated that reference throughout the
     specification to features, operations, or components using singular terms should not
     be construed as excluding a plurality thereof unless the context expressly indicates
     otherwise. Where ranges are given, all intermediate values and subranges are
     understood to be disclosed as if specifically recited.
     [0070]      In another embodiment, the above disclosure is a description of the
     invention and is not intended to limit the scope of the invention. Other variations
     and modifications of the above-described embodiment shall be apparent to those
     skilled in the art and are intended to fall within the scope of the invention as defined
     in the following claims.


     Dated This 06th day of September 2026


                                                                           (Kuldeep Singh)
                                                      Authorized Agent for the Applicant,
                                              Indian Patent Agent Regn No. IN/PA-4358




                                         CLAIMS
     WE CLAIM:
            1. A distributed food ordering system (10) comprising:
            a document database (12) configured to store user identity records,
     wallet balances, and a financial ledger;
            a real-time database (14) configured to store live inventory counts
     and active order records, wherein said document database (12) and said
     real-time database (14) are non-transactionally-linkable;
            a serverless order orchestrator (16) configured to:
              validate identity and balance via a first document-database
     transaction and allocate an order token;
              sequentially execute real-time-database optimistic concurrency
     transactions per cart item to decrement stock, accumulating each committed
     item into a compensating array, and upon failure of any per-item transaction,
     execute compensating increment transactions over said compensating array
     and abort order creation without wallet deduction; and
              upon success of all per-item stock transactions, deduct wallet
     balance and write a ledger entry via a second document-database transaction
     and create an active order record in said real-time database;
            wherein said validation, stock locking with compensating rollback,
     and financial settlement execute synchronously within a single serverless
     invocation prior to client success response.
            2. The system of claim 1, wherein said per-item optimistic concurrency
     transaction further sets an availability flag to false when decremented stock
     is at or below a threshold, and wherein said system further comprises a live
     menu merge module maintaining dual subscriptions to said document database
     (12) and said real-time database (14) and overlaying live stock and said
     availability flag onto canonical menu metadata upon either update.
            3. The system of claim 1 or 2, further comprising a transport-layer
     kill-switch module configured to pre-register a server-side state-mutation
     hook on a global configuration node, wherein transport-layer disconnection
     of an administrative client triggers server-side execution of said hook to a
     blocking state, and wherein said serverless order orchestrator (16) validates
     said node as a precondition and rejects order creation when in blocking state.
            4. The system of any of claims 1 to 3, further comprising a chronological
     sweep module configured to periodically poll said active order records, filter
     by a pending physical-verification flag and a time-delta exceeding a threshold,
     and for each matching record execute a real-time-database increment to restore
     stock, write an archival record to a historical store, and delete said active
     order record.
            5. The system of any of claims 1 to 4, further comprising a price
     anti-spoofing module configured to cache document-database menu prices with
     a time-to-live, recompute a server total from cart identifiers and quantities,
     and reject when absolute difference from a client-submitted total exceeds a
     tolerance.
            6. The system of any of claims 1 to 5, further comprising an idempotent
     redemption module configured to execute a real-time-database check-and-set
     transaction on a collection flag of said active order record, atomically setting
     said flag and rejecting duplicate collection scans.
            7. The system of any of claims 1 to 6, further comprising a category-based
     routing module configured to resolve per-item food categories, match counters
     by category map, and write per-counter ticket queue entries with uncategorized
     fallback, and a thermal fallback module attempting local print-server POST
     serialized via a promise chain with iframe fallback on failure.
            8. A computer-implemented method for distributed atomic order placement
     across non-transactionally-linkable stores, the method comprising:
             validating, in a first document-database transaction, user identity and
     wallet balance and allocating an order token;
             sequentially decrementing stock via real-time-database optimistic
     concurrency transactions per cart item, accumulating committed items into a
     compensating array, and upon any per-item failure executing compensating
     increment transactions over said array and aborting without wallet deduction;
             upon success of all stock transactions, deducting wallet balance and
     writing a ledger entry via a second document-database transaction and creating
     an active order record in said real-time database;
             wherein said steps execute synchronously within a single serverless
     invocation prior to client success response.
            9. The method of claim 8, further comprising pre-registering a server-side
     state-mutation hook on a global configuration node, executing said hook
     server-side upon transport-layer disconnection of an administrative client to
     a blocking state, and validating said node as a precondition to order creation;
             periodically polling active order records, filtering by pending physical-
     verification flag and time-delta exceeding a threshold, and restoring stock,
     archiving, and deleting matching records.
            10. A non-transitory computer-readable medium storing instructions that,
     when executed by one or more processors, cause the one or more processors
     to perform the method of claim 8.

     Dated This 06th day of September 2026


                                                                        (Kuldeep Singh)
                                                    Authorized Agent for the Applicant,
                                            Indian Patent Agent Regn No. IN/PA-4358




                                        ABSTRACT
                DISTRIBUTED DUAL-DATABASE FOOD ORDERING SYSTEM
                WITH TRANSPORT-LAYER KILL-SWITCH AND AUTOMATED
                DEADLOCK RESOLUTION
     A system (10) includes a document database (12) and a real-time database (14)
     that are non-transactionally-linkable, and a serverless orchestrator (16) validating
     identity/balance, sequentially locking stock via optimistic concurrency with a
     compensating array and rollback on partial failure, then deducting wallet and
     writing a ledger synchronously in one invocation. A kill-switch pre-registers a
     server-side hook flipping a global node to blocking on transport disconnection,
     validated as precondition to all order entry. A chronological sweep restores stock
     for stale pending-verification orders.
     (FIG. 1)

     Dated This 06th day of September 2026


                                                                        (Kuldeep Singh)
                                                    Authorized Agent for the Applicant,
                                            Indian Patent Agent Regn No. IN/PA-4358
