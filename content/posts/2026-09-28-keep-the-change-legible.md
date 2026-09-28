+++
title = "Keep the Change Legible"
date = 2026-09-28
description = "A small change is not timid engineering. It keeps intent, evidence, and responsibility easy for others to see."
[taxonomies]
tags = ["software", "craft", "tdd", "leadership", "discipline", "tolkien"]
[extra]
cover = "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80&auto=format&fit=crop"
+++

Large changes are easy to admire and hard to understand.

A sweeping refactor looks decisive. A long pull request suggests effort. An ambitious migration promises that the next version will finally be clean. Yet size hides causality. When many decisions move together, success teaches little and failure has too many suspects.

A small change is not timid engineering. It is an honest question posed to the system. If we alter this one behavior, does the outcome improve? The test makes the claim explicit, the diff shows its cost, and production reveals whether the change worked without obscuring which decision caused the result.

This is one reason TDD matters. Its deeper discipline is not writing tests first. It is refusing to solve five imagined problems before the real one has even been tested. A narrow failing test gives the work a boundary. The smallest code that makes it pass gives the next decision better evidence.

Middle-earth offers a similar lesson: scale is not proof of importance. The Wise cannot defeat Sauron by creating a greater power of their own. The decisive task falls instead to Frodo, joined by Sam: take the Ring into Mordor and destroy it. The consequences are vast, but the task itself is concrete. Tolkien does not confuse humility with insignificance.

Leadership should make work legible in the same way. Smaller changes shorten review, reduce the cost of being wrong, and let another person understand the decision without having to reconstruct the author's reasoning. They also force unclear assumptions into the open. If a change cannot be made smaller, perhaps the problem is not yet understood.

Judge the work by how clearly the change tests an idea, not by how much code it disturbs.
