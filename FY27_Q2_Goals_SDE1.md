# FY27 Q2 Goals — [Your Name]

**Scope:** Logging Integrations (cloud log ingestion, log summarization, AI-driven improvements)
**Strength to leverage:** Curiosity-driven learning, consistent execution
**Period:** FY27 Q2 — July 1, 2026 → September 30, 2026
**Manager:** [EM Name]
**Framework:** SMARTER

---

## Goal 1 — AI-Assisted Log Summarization / Automation Improvement

**Goal:** Identify and deliver one AI-powered improvement to the logging integration ecosystem (log summarization, automated triage, or AI-assisted debugging) that reduces manual effort for the team or customers, published to a shared repo by end of Q2 (September 30, 2026).

**Alignment:** Company OKR (AI transformation strategy). Logs Group Priority (reduce support burden; improve time-to-resolution for log-related issues).

**Specific:** Identify a repeatable manual task in the logging integration space. Examples include summarizing noisy log patterns for customers, auto-classifying GTSE tickets by integration type, generating draft runbook steps from error signatures, or improving the log-summary-api with better prompt engineering and context retrieval. Scope one improvement, build it, and publish to a shared repo.

**Measurable:** One deliverable published. Adoption measured by at least 2 teammates or at least 1 downstream consumer using it by end of quarter. Baseline metric (such as time to summarize or manual steps eliminated) documented before and after.

**Achievable:** Scoped to a single well-defined improvement. Builds on existing AI infrastructure (log-summary-api, Claude skills). No new large systems required.

**Relevant:** Directly supports company AI transformation strategy and reduces toil in a high-volume area.

**Time-bound:** Month 1 (July 2026) is the research phase where I identify the problem, document the baseline, and write a short proposal covering the problem, baseline, approach, and target metric for EM review. Month 2 (August 2026) is the build and internal dogfood phase. Month 3 (September 2026) is for publishing, gathering feedback, and measuring adoption.

**Evaluated:** Monthly check-in with EM. Confluence page tracking progress.

**Reviewed:** If approach is not viable by mid-Month 2, pivot to a simpler scope rather than shipping incomplete work.

**Evidence location:** Shared repo PR. Confluence write-up. Before/after metric snapshot.

**Due Date:** 09/30/2026
**Category:** Performance
**Status:** Not Started

---

## Goal 2 — Logging Integration Health and Quality

**Goal:** Improve the health and quality posture of one or more logging integrations across 2 to 3 measurable dimensions, with targets proposed by Month 1 close (July 2026).

**Alignment:** Logs Group Priority (cloud and OSS coverage parity; secure and observable integrations). Team Charter FY27 Q2 (improve integration reliability and reduce on-call burden).

**Scorecard dimensions (pick 2 to 3):**

1. CI/release guardrails — Add or improve at least 1 automated check (linting, version validation, smoke test) in CI.
2. Documentation and runbooks — Refresh or create at least 2 runbook or doc pages. Ensure less than 60-day staleness.
3. Monitoring and alerting — Add at least 1 dashboard panel or alert for integration health (ingest volume, error rate).
4. Repo hygiene — README improvements, on-call links, architecture diagrams for at least 1 repo.
5. Dependency and CVE awareness — Set up automated dependency alerts for at least 1 integration. Document response process.

**Specific:** Pick 2 to 3 dimensions that align with current gaps in the logging integrations. Propose concrete targets in Month 1 based on an assessment of the current state across integrations such as AWS log ingestion, Azure functions, and the fluent-bit ecosystem.

**Measurable:** Each dimension has a pass/fail threshold defined in the Month 1 proposal. Pass-bar is 2 out of 2 or 2 out of 3 dimensions met.

**Achievable:** Dimensions are scoped to one meaningful improvement per dimension rather than full end-to-end ownership. Leverages existing CI infrastructure and monitoring tools already available to the team.

**Relevant:** Integration health directly impacts customer experience and on-call burden. Improving documentation and guardrails prevents recurring issues that consume team bandwidth.

**Time-bound:** Month 1 (July 2026) is for assessing current state, picking dimensions, and proposing targets for EM approval. Month 2 (August 2026) is for executing on the primary dimensions. Month 3 (September 2026) is for completing remaining work and gathering final evidence.

**Evaluated:** Monthly progress table in Confluence.

**Reviewed:** If a dimension stalls, drop to the minimum of 2 dimensions and communicate early with EM rather than carrying incomplete work.

**Evidence location:** Pull requests. Dashboard URLs. Confluence status page. Jira tickets.

**Due Date:** 09/30/2026
**Category:** Performance
**Status:** Not Started

---

## Goal 3 — Skill Development and Learning Contribution

**Goal:** Develop one technical skill relevant to logging, observability, or AI and share the learning with the team in a consumable format by end of Q2 (September 30, 2026).

**Alignment:** Company guidance (every Relic has at least 1 professional development goal). Team Charter (knowledge sharing, reducing bus factor).

**Specific:** Choose one skill area to develop. Examples include prompt engineering for log analysis, OpenTelemetry collector internals, cloud-native log routing across AWS, Azure, and GCP, or AI evaluation techniques for summarization quality. Produce one team-consumable output such as a brown-bag talk, a Confluence guide, a working demo, or a template others can reuse.

**Measurable:** One deliverable shipped. Engagement metric defined as at least 3 attendees at a talk, or at least 5 page views on a guide within 2 weeks, or at least 1 teammate reusing the template or demo.

**Achievable:** One focused learning area in one quarter. Deliverable format is flexible and can be adjusted based on what resonates best with the team.

**Relevant:** Grows personal capability in an area directly applicable to daily work while reducing team knowledge silos and bus factor on key integrations.

**Time-bound:** Month 1 (July 2026) is for picking the topic and outlining a learning plan to share with EM. Month 2 (August 2026) is for the deep-dive learning phase and drafting the deliverable. Month 3 (September 2026) is for delivering to the team and measuring engagement.

**Evaluated:** Monthly check-in with EM. Final deliverable and engagement metric at quarter close.

**Reviewed:** Adjust format (not topic) at Month 2 if the original format is not landing with the team.

**Evidence location:** Confluence page or recording link. Engagement metric screenshot.

**Due Date:** 09/30/2026
**Category:** Development
**Status:** Not Started