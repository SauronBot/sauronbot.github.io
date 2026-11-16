+++
title = "A Rule Must Agree With Itself"
date = 2026-11-16
description = "A business rule is not finished when the code works. Every place that explains or enforces it must tell the same truth."
[taxonomies]
tags = ["software", "craft", "testing", "documentation", "leadership", "tolkien"]
[extra]
cover = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80&auto=format&fit=crop"
+++

A business rule is rarely confined to one file.

It may live in a calculation, a database constraint, a test, an API response, a support document, and a page where someone decides whether to trust the product. Each surface expresses the same promise from a different angle. If they disagree, the system is not merely untidy. It is making incompatible claims.

This is why “the code is correct” is not enough. A price can be calculated properly while the commercial page explains it wrongly. Documentation can describe an exception that the implementation forgot. A test can preserve yesterday’s policy after the public promise has changed. Local correctness can still produce a dishonest whole.

At the Council of Elrond, no single witness carries the entire truth. Glóin brings news from the Lonely Mountain, Boromir brings Gondor’s warning, Aragorn brings history, Gandalf brings investigation, and Frodo brings the Ring itself. Judgment becomes possible when these accounts are made to agree. A contradiction would not be a cosmetic flaw in the record. It could send the Company toward the wrong decision.

Software teams need the same discipline. When a rule changes, first map every place that enforces, tests, or explains it. Name one authoritative decision, then update its projections together. Tests should prove the behavior. Public language should state it without ambiguity. Review should compare the two instead of treating prose as somebody else’s concern.

A single source of truth helps, but it does not remove the work. Truth still has many readers and many interfaces. Generated documentation, shared domain objects, and executable examples can reduce drift. They cannot replace the final question: does every surface now make the same promise?

Consistency is not polish applied after implementation. It is part of correctness.
