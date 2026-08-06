# Category Labs — research
Provider/key: ashby:category-labs | company_type: product

What they do: Category Labs (formerly Monad Labs) builds Monad, a high-performance, 100%
EVM-compatible Layer 1 blockchain whose public mainnet is live. In their own words they are "a team
of systems engineers and researchers on a mission to design and build at the frontier of decentralized
technology" who "strive to deliver significant improvements over existing blockchain solutions". The
actual artefacts are systems software: a parallel-execution EVM
(github.com/category-labs/monad), a custom state database, and a BFT consensus client
(github.com/category-labs/monad-bft) — "all developed in the open". Stated performance targets on
their site: 10,000 transactions per second, 1-second block times, single-slot finality.

How they describe themselves: Site tagline: "We make complex systems incredibly fast" — they frame
performance as an engineering problem to be solved rather than a marketing claim. The JDs' stated
reasons to join, verbatim: "Challenging problems: You'll work on extremely challenging problems with
massive impact"; "Huge opportunity: The Ethereum Virtual Machine (EVM) standard is ubiquitous, but
existing EVM-compatible chains are very slow"; "The right team: You'll be part of a small,
exceptional team (engineers and researchers make up 90% of the team)"; "Open by default: Our core
software is public." They also state explicitly that they do not screen on tool tenure: "The stack
turns over every few months, so what matters is that you pick up new tools fast and know where and
when they apply."

Size / stage / funding: Series A of $225M led by Paradigm (stated verbatim in every JD). Other
investors listed on their site: Electric Capital, Coinbase Ventures, Dragonfly, Castle Island
Ventures, EGirl Capital. Small team — "engineers and researchers make up 90% of the team". Exact
headcount not disclosed on the site.

Locations / HQ: New York City (the JDs reference an in-office NYC lunch and dinner stipend and the
postings are tagged "New York (Hybrid), Remote"). The website does not state an HQ or a remote policy.

Remote policy: Hybrid-NYC or remote — all three live postings are tagged both "Remote" and
"New York (Hybrid)". The company employs internationally through an Employer of Record: "Benefits for
employees hired through an EOR (outside of the US) will be based on EOR offerings and country-specific
requirements."

Remote-Canada eligibility: LIKELY YES, though Canada is never named. The evidence is structural
rather than explicit: postings are tagged Remote; the salary section says "This reflects the minimum
and maximum range across US locations... If you are based outside of the US, we have geographic
considerations that may impact your final compensation"; and a full EOR pathway for non-US hires is
described in the benefits block. That is a company set up to hire outside the US, but the specific
countries are UNVERIFIED. A BC hire would be paid on a geo-adjusted (i.e. lower) scale than the
posted US band. Timezone: an NYC-anchored team means Eastern-hours pull from Mountain Time.

Engineering & tech: Very low-level systems work in C++ and Rust. Live roles cover core protocol
(consensus mechanism, gossip protocol, state synchronization, leader election), compilers (a bytecode
execution graph builder enabling speculative pre-execution of control-flow paths), and formal
verification (machine-checked proofs about production C++ using Rocq/Coq with the Iris separation
logic framework and the BRiCk formal semantics of C++, covering concurrent features like optimistic
execution). Requirements are 5+ years in C++/Rust/C building performant systems from scratch —
databases, device drivers, embedded systems. Core software is public on GitHub.

Notable / other: Every live JD posts the same US base range, $180,000-$250,000, explicitly excluding
"benefits, token, or equity incentives" — so a token/equity component sits on top. Benefits for all
full-time staff: private health insurance options, flexible PTO, monthly wellness reimbursement, paid
parental leave; US staff additionally get 100% paid medical/dental/vision (75% for dependents),
HSA+FSA, 401(k) with match, and an in-office NYC meal stipend. The company publishes blogs and
papers/talks at category.xyz.

Open relevant roles (sample): Senior Software Engineer (core protocol / consensus); Senior Software
Engineer, Compiler; Senior Software Engineer, Formal Verification.

Sources: https://www.category.xyz/ (fetched); the 3 live JD bodies under
https://jobs.ashbyhq.com/category-labs (cited; already captured in data/posting-research/).
