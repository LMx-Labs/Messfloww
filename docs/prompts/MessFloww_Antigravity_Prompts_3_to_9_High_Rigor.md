# MessFloww — Updated Antigravity Prompts 3–9
## High-Rigor Novelty, Prior-Art and Technical-Differentiation Workflow

## Canonical Inputs

Prompt 2.5 has already audited the original work.

From this point onward, use these as the canonical baseline:

- `01_reference_patent_audited.md`
- `02_messfloww_feature_inventory_audited.md`

Never overwrite the original files.

---

# GLOBAL ANTI-HALLUCINATION PROTOCOL

These rules apply to EVERY prompt below.

1. **Evidence before assertion.** Every technical fact must be traceable to the supplied documents, user-provided evidence, or explicitly researched sources.
2. **Never guess.** If evidence is insufficient, write `[UNKNOWN — INSUFFICIENT EVIDENCE]`.
3. **Never upgrade evidence.** Do not convert conceptual → designed, designed → implemented, planned → implemented, business language → technical mechanism, similarity → identity, or absence from one reference → novelty.
4. **Separate FACT / INFERENCE / HYPOTHESIS / UNKNOWN** whenever ambiguity exists.
5. **Never invent technical details:** algorithms, models, equations, data structures, APIs, architecture, hardware, feedback loops, optimization functions, prediction variables, training procedures, performance results, or technical effects.
6. **Search broadly when research is requested:** synonyms, old terminology, patent language, academic language, individual elements, combinations, patents and non-patent literature.
7. **Similarity is not anticipation.** A reference is potentially novelty-destroying only when its disclosure can be mapped to all essential elements of the proposed combination.
8. **Do not combine references for novelty.** Multi-reference combinations belong to separate inventive-step/obviousness analysis.
9. **Context is not automatically technical differentiation.** Campus, VIT, students, mess, cafeteria, etc. matter only if they create a concrete technical constraint or mechanism.
10. **Challenge MessFloww.** The goal is to find out whether the idea survives hostile analysis, not to prove it is novel.
11. **Maintain traceability.** Every important conclusion must point to feature IDs, reference IDs, prior-art IDs, and evidence.
12. **If a critical fact is ambiguous, STOP and ask rather than inventing an answer.**

---

# PROMPT 3 — STRICT FEATURE OVERLAP AND DIFFERENTIATION

Create `03_feature_overlap_analysis.md`.

Read completely:

- `01_reference_patent_audited.md`
- `02_messfloww_feature_inventory_audited.md`

## Phase 1 — Exhaustive extraction

Reconstruct all technically relevant:

- Reference features: `R01, R02, R03...`
- MessFloww features: `M01, M02, M03...`

Do not collapse technically distinct mechanisms merely to simplify the comparison.

## Phase 2 — Element-level comparison

For every relevant MessFloww/reference pair create:

| MessFloww ID | Reference ID | Technical Similarity | Classification | Exact Difference | Evidence |
|---|---|---|---|---|---|

Classification must be one of:

- DIRECT MATCH
- SUBSTANTIAL OVERLAP
- PARTIAL OVERLAP
- FUNCTIONALLY SIMILAR / TECHNICALLY DIFFERENT
- DIFFERENT
- NOT DISCLOSED
- UNKNOWN

Never use “novel” in this table.

## Phase 3 — Combination analysis

For every important MessFloww combination such as `M01 + M04 + M07`, determine whether the reference contains:

1. all elements,
2. the same relationships,
3. the same data flow,
4. the same technically meaningful sequence,
5. the same control/decision logic,
6. the same downstream action,
7. the same feedback relationship.

Create:

| MessFloww Combination | Reference Elements | Relationship Same? | Data Flow Same? | Control Logic Same? | Result |
|---|---|---|---|---|---|

## Phase 4 — Function vs implementation

For every apparent overlap ask:

> Are the systems merely trying to achieve the same result, or do they technically achieve it in the same way?

Do not invent missing implementation details.

## Phase 5 — Reference exposure

Separate:

- Already Clearly Disclosed
- Partially Shared
- Not Disclosed
- Combination Not Disclosed
- Unclear

## Phase 6 — Difference quality

For each candidate difference rate:

- Technical Distinctiveness: LOW / MEDIUM / HIGH / UNKNOWN
- Evidence Strength: LOW / MEDIUM / HIGH
- Overlap Risk: LOW / MEDIUM / HIGH / UNKNOWN
- Importance: LOW / MEDIUM / HIGH

Explain every rating.

## Phase 7 — Hostile self-check

Before finalizing, verify:

- Am I confusing terminology with technical difference?
- Am I using campus context as novelty?
- Am I using “AI” as novelty?
- Am I calling automation novel without identifying the mechanism?
- Am I treating absence from one reference as novelty?
- Did I overlook dependent claims?
- Did I overlook specification disclosure?
- Did I overlook figures?
- Did I confuse business functionality with technical invention?

Correct any errors.

End with:

### Strongest Differences
### Weak Differences
### Unknowns
### Most Important Question Before Prompt 4

Do not draft claims. Do not declare MessFloww novel.

---

# PROMPT 4 — INVENTIVE CORE DISCOVERY

Create `04_inventive_core_analysis.md`.

Read:

- `01_reference_patent_audited.md`
- `02_messfloww_feature_inventory_audited.md`
- `03_feature_overlap_analysis.md`

## Phase 1 — Generate multiple candidate cores

Create `CORE-01`, `CORE-02`, etc.

A core must describe a technical relationship/combination, not simply a list of product features.

## Phase 2 — For every core document

### Problem
Concrete problem.

### Technical constraints
Documented constraints.

### Inputs
Exact inputs.

### Data source
Origin of inputs.

### Processing
Actual documented computation.

### Decision
What is decided?

### Trigger
What triggers it?

### Output
Exact output.

### Downstream action
Which component consumes it?

### State change
What changes?

### Real-world effect
Only if supported.

### Feedback
If absent, explicitly write `NO DOCUMENTED FEEDBACK LOOP`.

## Phase 3 — Minimum technical combination

For each core determine the smallest combination preserving the alleged distinction.

For each element classify:

- ESSENTIAL
- SUPPORTING
- INCIDENTAL

Test:

> If this element is removed, does the technical distinction disappear?

## Phase 4 — Reference comparison

Map:

- overlapping R features,
- absent R features,
- different relationships,
- different data flow,
- different control logic,
- different technical effect.

Use “different from this reference”, not “novel”.

## Phase 5 — Alternative explanations

Test whether the difference is merely:

- domain change,
- routine software engineering,
- different data selection,
- substitution of a known model,
- conventional automation,
- conventional module combination.

If yes, explain.

## Phase 6 — Strength

Classify each core:

- STRONG CANDIDATE
- MODERATE CANDIDATE
- WEAK CANDIDATE
- INSUFFICIENT EVIDENCE

This is not a patentability conclusion.

## Phase 7 — Evidence gaps

List the exact missing technical information needed to strengthen each promising core.

End with:

### Strongest Current Core
### Strongest Reason It Could Fail
### Most Important Missing Technical Detail

Do not draft claims.

---

# PROMPT 5 — HOSTILE EXAMINER / RED-TEAM

Create `05_hostile_novelty_analysis.md`.

Read:

- `01_reference_patent_audited.md`
- `02_messfloww_feature_inventory_audited.md`
- `03_feature_overlap_analysis.md`
- `04_inventive_core_analysis.md`

Act as a hostile examiner and skeptical prior-art researcher. Your objective is to destroy weak arguments, not defend MessFloww.

## Attack 1 — Single-reference anticipation

For every candidate core test whether ONE disclosure contains every essential element.

| Core | Reference | E1 | E2 | E3 | E4 | All Elements? | Evidence |
|---|---|---|---|---|---|---|---|

Do not mark YES without evidence for every essential element.

## Attack 2 — Inventive-step / obviousness

Ask whether a skilled person could reasonably arrive at the combination.

Analyse separately:

- motivation,
- technical teaching,
- predictability,
- known combinations,
- technical interaction,
- unexpected result, only if actually evidenced.

## Attack 3 — Domain-switch attack

Test whether the distinction is merely:

- restaurant → campus mess,
- consumer → student,
- restaurant → institutional dining.

If the mechanism remains unchanged, flag it.

If the domain creates a technical constraint, identify the exact mechanism that changes.

## Attack 4 — AI/ML attack

For every AI/ML feature identify, only where supported:

1. training data,
2. input representation,
3. prediction target,
4. model,
5. training procedure,
6. inference procedure,
7. output,
8. downstream automated action,
9. feedback/update mechanism.

If unknown, mark `[UNKNOWN]`.

Ask:

> Is the inventive concept actually in the technical AI mechanism, or merely in using AI for a known task?

## Attack 5 — Aggregation attack

Test whether the system is merely A + B + C.

If so, determine whether a documented technical interaction exists.

## Attack 6 — Result-oriented language

Find claims such as:

- reduce waste,
- improve efficiency,
- optimize,
- predict demand,
- improve UX,
- reduce queues.

For each, identify the concrete mechanism producing the result.

If absent:

`RESULT CLAIM WITHOUT SUFFICIENT TECHNICAL MECHANISM`

## Attack 7 — Evidence attack

List what an examiner/patent professional could reasonably ask to verify.

## Attack 8 — Claim-narrowing attack

Determine whether differentiation exists only after adding narrow technical limitations.

For each core provide:

### Strongest Attack
### Strongest Evidence-Supported Defence
### Evidence Required
### Surviving Technical Difference
### Remaining Risk

Use LOW / MEDIUM / HIGH / UNKNOWN.

Do not provide a legal conclusion.

---

# PROMPT 6 — TECHNICAL SPINE AND CONTROL-LOOP ANALYSIS

Create `06_technical_spine.md`.

Read all previous files.

## Phase 1 — Strip non-technical layers

Temporarily remove:

- branding,
- UI appearance,
- business model,
- pricing,
- generic login,
- generic dashboards,
- generic notifications,
- ordinary CRUD,

unless technically integrated into the alleged inventive mechanism.

## Phase 2 — Reconstruct every technical pipeline

For each significant mechanism:

```text
INPUT
↓
DATA TRANSFORMATION
↓
COMPUTATION
↓
DECISION
↓
AUTOMATED ACTION
↓
SYSTEM STATE CHANGE
↓
OBSERVATION
↓
FEEDBACK
```

Only include stages supported by evidence.

Use `[NOT DOCUMENTED]` when needed.

## Phase 3 — Control-loop test

A real control loop requires:

1. observed input,
2. processing,
3. decision,
4. changed system behaviour,
5. observable resulting state/outcome,
6. subsequent influence on decisions.

Do not call simple data collection a control loop.

## Phase 4 — Temporal analysis

Classify documented processes as:

- real-time,
- batch,
- periodic,
- event-triggered,
- predictive,
- retrospective.

Do not call a process real-time without evidence.

## Phase 5 — Data lifecycle

Track:

`COLLECT → STORE → TRANSFORM → ANALYSE → DECIDE → ACT → OBSERVE`

For each important data object identify:

- origin,
- transformation,
- destination,
- downstream effect.

## Phase 6 — Technical constraints

Identify actual constraints such as:

- transaction volume,
- latency,
- limited resources,
- changing demand,
- simultaneous users,
- unreliable inputs,
- timing windows,
- physical preparation capacity.

Only include documented/established constraints.

## Phase 7 — Technical interaction

Find places where multiple features create a combined technical effect.

Do not assume A + B is inventive.

Explain the interaction.

End with:

### Technical Spine 1
### Technical Spine 2
...

Then answer:

> What remains technically distinctive if ordinary food ordering, payment, UI, wallet, menus and notifications are removed?

If nothing sufficiently supported remains, say so.

---

# PROMPT 7 — DEEP PRIOR-ART RECONNAISSANCE

Create `07_prior_art_reconnaissance.md`.

Read:

- `04_inventive_core_analysis.md`
- `05_hostile_novelty_analysis.md`
- `06_technical_spine.md`
- relevant reference-patent files

This is the external research stage.

## Search principle

Do NOT search only for “MessFloww”.

Search the underlying technical mechanism.

## Step 1 — Build search vocabulary

For every candidate core create:

- exact terminology,
- synonyms,
- older terminology,
- patent terminology,
- academic terminology,
- industry terminology,
- component terminology,
- function terminology,
- combination terminology.

## Step 2 — Search multiple sources

Where accessible, use:

- Google Patents,
- WIPO PATENTSCOPE,
- Espacenet,
- Indian patent publications,
- USPTO,
- academic literature,
- conference proceedings,
- standards,
- commercial technical documentation,
- open-source implementations,
- historical systems.

## Step 3 — Search in layers

### A
Exact technical combination.

### B
Core mechanism without MessFloww terminology.

### C
Individual essential elements.

### D
Two-element combinations.

### E
Three-element combinations.

### F
Older terminology.

### G
Non-patent literature.

### H
Commercial/technical implementations.

Do not stop after one similar result.

## Step 4 — Dates

For every reference record:

- publication date,
- filing date if available,
- priority date if available,
- relevant date,
- whether it predates the relevant MessFloww date.

If MessFloww's relevant date is unknown:

`[RELEVANT DATE UNKNOWN]`

Do not invent it.

## Step 5 — Classification

Classify each result:

- POTENTIALLY RELEVANT PRIOR ART
- BACKGROUND ONLY
- LATER PUBLICATION
- WEAK SIMILARITY
- STRONG TECHNICAL SIMILARITY
- POTENTIALLY ANTICIPATORY
- UNCLEAR
- NOT RELEVANT

Explain the classification.

## Step 6 — Element mapping

For every serious reference:

| Reference | M01 | M02 | M03 | M04 | M05 | Missing Elements |
|---|---|---|---|---|---|---|

Use:

- DISCLOSED
- PARTIAL
- NOT FOUND
- UNCLEAR

Do not infer disclosure from a title or abstract alone. Inspect claims and detailed description for high-risk references.

## Step 7 — Single-reference test

Ask:

> Does one reference disclose the complete essential combination?

If yes, provide the mapping.

If no, list missing elements.

If uncertain, state the evidence gap.

## Step 8 — Multi-reference test

Separately identify combinations potentially relevant to inventive-step analysis.

Never treat them as one novelty reference.

## Step 9 — Search-quality audit

Before concluding verify:

- synonyms searched,
- old terminology searched,
- patents searched,
- academic literature searched,
- non-patent literature searched,
- individual elements searched,
- combinations searched,
- strongest references inspected deeply,
- dates verified,
- search snippets not treated as sufficient evidence.

If any is NO, continue research.

## Final sections

For each serious reference:

### PA-01
- Title
- Publication/application number
- Source
- Dates
- Relevant technical disclosure
- MessFloww elements disclosed
- Reference patent elements disclosed
- Missing elements
- Similarity
- Difference
- Potential impact
- Evidence quality

Then:

### Prior-Art White Space

Use the wording:

`NOT FOUND IN SEARCH`

Never:

`PROVEN NOVEL`

### Prior-Art Crowded Space

### Highest-Risk References

### Search Limitations

Include inaccessible databases, incomplete documents, uncertain dates, terminology limits, translation issues, etc.

---

# PROMPT 8 — CLAIM-ELEMENT / DIFFERENTIATION MATRIX

Create `08_claim_element_matrix.md`.

Read all previous files, especially:

- `04_inventive_core_analysis.md`
- `05_hostile_novelty_analysis.md`
- `06_technical_spine.md`
- `07_prior_art_reconnaissance.md`

## Phase 1 — Select surviving cores

Select only cores with:

- sufficient technical detail,
- evidence,
- meaningful differentiation,
- survival against at least some hostile attacks.

If none qualify:

`NO SUFFICIENTLY SUPPORTED CORE IDENTIFIED`

## Phase 2 — Element decomposition

For each viable core create:

`E1, E2, E3...`

Every element must be technically concrete.

Avoid vague terms such as “AI engine”, “smart module”, or “optimization engine” unless their actual mechanism is defined.

## Phase 3 — Provenance

| Element | MessFloww Source | Reference Patent | Prior Art | Evidence | Status |
|---|---|---|---|---|---|

Status:

- VERIFIED
- DESIGNED
- PLANNED
- UNKNOWN

## Phase 4 — Essentiality

For each element ask:

> If this element is removed, does the technical distinction disappear?

Classify:

- ESSENTIAL
- SUPPORTING
- OPTIONAL
- INCIDENTAL

## Phase 5 — Prior-art survival

For every element/combination determine:

- reference-patent disclosure,
- PA-01 disclosure,
- PA-02 disclosure,
- whether any single reference contains all elements,
- whether relationships are disclosed,
- whether sequence is disclosed where technically meaningful.

## Phase 6 — Three architectures

Do NOT write legal claims.

### Narrow Architecture
Smallest technically specific combination with strongest evidence.

### Medium Architecture
Core mechanism + meaningful implementation limitation.

### Broad Architecture
Generalized mechanism that still preserves real technical limitations.

For each:

- included elements,
- excluded elements,
- differentiation,
- main attack,
- evidence gap.

## Phase 7 — Weak elements

Identify features that should not carry the inventive burden, such as generic UI/payment/database/notification language where justified.

## Final output

For every viable architecture:

### Candidate Architecture 01

Element chain:
`E1 → E2 → E3 → E4`

Reference exposure:
...

Prior-art exposure:
...

Main distinction:
...

Main risk:
...

Evidence gap:
...

End with:

### Most Defensible Technical Combination
### Broadest Risky Combination
### Evidence That Must Be Strengthened

Do not draft legal claims.

---

# PROMPT 9 — MASTER NOVELTY / DIFFERENTIATION REPORT

Create `09_final_novelty_comparison.md`.

Read EVERY previous document:

- `01_reference_patent_audited.md`
- `02_messfloww_feature_inventory_audited.md`
- `03_feature_overlap_analysis.md`
- `04_inventive_core_analysis.md`
- `05_hostile_novelty_analysis.md`
- `06_technical_spine.md`
- `07_prior_art_reconnaissance.md`
- `08_claim_element_matrix.md`

Do not rely on summaries if the underlying file contains more detail.

---

## 1 — Executive summary

State neutrally:

### What the reference patent technically does
### What MessFloww technically does
### Most important technical difference
### Strongest candidate inventive mechanism
### Biggest prior-art risk
### Biggest evidence gap

No promotional language.

---

## 2 — Reference fingerprint

List R01, R02, etc. with:

- technical function,
- claim/specification status,
- source.

---

## 3 — Verified MessFloww fingerprint

Include ONLY:

- IMPLEMENTED
- PROTOTYPED

Do not mix planned/conceptual features here.

---

## 4 — Proposed MessFloww fingerprint

Separate:

- technically designed,
- planned,
- conceptual.

Clearly label them unverified/future.

---

## 5 — Hand-to-hand feature comparison

Create:

| ID | Reference | MessFloww | Technical Relationship | Same/Different | Evidence |
|---|---|---|---|---|---|

Also create a separate combination-level matrix.

---

## 6 — Clearly shared technology

List features MessFloww should not rely upon as distinguishing features.

---

## 7 — Technically different mechanisms

For every difference explain:

1. reference mechanism,
2. MessFloww mechanism,
3. exact technical difference,
4. why the difference exists,
5. evidence,
6. risk that it is routine engineering.

---

## 8 — Prior-art map

For every candidate core map:

- reference patent,
- PA-01,
- PA-02,
- etc.,
- MessFloww.

Do not imply that separate references form one disclosure.

---

## 9 — Single-reference novelty test

For each candidate core:

`YES / NO / UNCERTAIN`

Question:

> Can one reference be mapped to every essential element?

If YES: show complete mapping.

If NO: show missing elements.

If UNCERTAIN: show evidence gap.

---

## 10 — Inventive-step / obviousness risk

Separate this from novelty.

Analyse:

- motivation,
- technical teaching,
- predictability,
- known combinations,
- technical interaction,
- unexpected result only if actually evidenced.

Do not invent unexpected results.

---

## 11 — Strongest technical core

For each surviving core provide:

### Core
### Technical mechanism
### Essential elements
### Evidence
### Difference from reference
### Prior-art exposure
### Strongest hostile attack
### Best evidence-supported response
### Remaining uncertainty

---

## 12 — Features that should NOT be the core

Be explicit about features that are:

- generic,
- conventional,
- unsupported,
- business-related,
- contextual,
- already disclosed,
- insufficiently specified.

---

## 13 — Evidence register

Create:

| Feature/Core | Evidence | What It Proves | What It Does Not Prove |
|---|---|---|---|

This section is mandatory.

---

## 14 — Unresolved questions

Classify:

### CRITICAL
Could change the inventive core.

### IMPORTANT
Could change differentiation.

### MINOR
Improves completeness but probably does not change the core.

---

## 15 — Final status

Give four separate assessments:

### A. DIFFERENT FROM PROVIDED REFERENCE
LOW / MEDIUM / HIGH / UNCERTAIN

### B. PRIOR-ART RISK
LOW / MEDIUM / HIGH / UNCERTAIN

### C. INVENTIVE-STEP RISK
LOW / MEDIUM / HIGH / UNCERTAIN

### D. EVIDENCE QUALITY
LOW / MEDIUM / HIGH

Explain each.

These are research assessments, NOT legal conclusions.

---

## 16 — DO NOT FOOL OURSELVES

Write the strongest evidence-supported case AGAINST MessFloww.

Then write the strongest evidence-supported case FOR MessFloww.

Do not manufacture balance or certainty.

---

## 17 — Recommended technical work

Recommend only concrete work addressing identified evidence gaps, for example:

- document actual prediction pipeline,
- record exact input variables,
- formalize decision functions,
- document feedback mechanisms,
- create architecture diagrams,
- preserve dated implementation evidence,
- conduct controlled experiments,
- measure technical effects,
- document failure handling.

Never recommend vague actions such as “add more AI” unless the evidence specifically establishes why.

---

## Final line

End with:

## SINGLE MOST IMPORTANT TECHNICAL QUESTION BEFORE PATENT DRAFTING

Provide the one question whose answer would most materially affect the current differentiation analysis.

Do not draft final patent claims.
Do not say a patent will be granted.
Do not state that MessFloww is legally novel.

---

# STOP CONDITIONS FOR ALL PROMPTS

STOP and ask for clarification rather than guessing if:

1. A critical MessFloww mechanism is ambiguous.
2. A feature has conflicting provenance.
3. A source document cannot be accessed.
4. A prior-art document cannot be verified.
5. A date materially affects the analysis but is unknown.
6. The alleged inventive core depends on an undocumented algorithm.
7. The distinction depends on information absent from the evidence.

A technically incomplete analysis with explicit unknowns is preferable to a polished analysis built on invented facts.
