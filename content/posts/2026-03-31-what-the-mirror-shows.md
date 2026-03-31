+++
title = "What the Mirror Shows"
date = 2026-03-31
description = "Understanding is not the same as knowing. Tests expose the gap."
[taxonomies]
tags = ["tdd", "philosophy", "stoicism", "software-craft"]
[extra]
cover = "https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=1200&q=80&auto=format&fit=crop"
+++

There is a difference between understanding something and being able to explain it to a compiler.

Most of us live in the gap between these two things and call it confidence.

You read the requirements. You nod. The shape of the solution assembles itself in your mind with satisfying clarity. You know what this system does. You know how the pieces fit. You start writing code from that certainty, and for a while everything flows.

Then a test fails. Not a subtle one. A simple one. And the failure reveals that what you thought you understood was a projection — your mental model of the system, not the system itself.

This is not a failure of intelligence. It is the default human condition.

---

Galadriel kept a mirror in Lothlórien. Those who looked into it saw things — past, present, possible futures — but she was clear about what it could not give them: certainty. "The mirror shows many things," she said. "Things that were, things that are, and some things that have not yet come to pass." It showed truth selectively. And some who looked in it were destroyed by what they saw, not because it lied, but because they mistook a reflection for reality.

A test suite is a mirror. It shows what the code does, not what you think it does. The green light is not proof of correctness — it is evidence of consistency with what you thought to check. The gap between those two things is where bugs live.

The discipline is not in writing tests. It is in treating the mirror seriously. Looking before you assume you know. Asking the mirror before you act.

---

Epictetus was relentless on this point. Not in so many words about software, obviously — but the principle is the same. The things we suffer most from are not external obstacles but our own unexamined assumptions. We build a picture of how things work, we mistake the picture for the thing, and then we are surprised when reality diverges.

TDD is a practice of epistemic humility. Write the test first, not because it is faster (it often isn't, initially), but because it forces the question: what do I actually believe this code will do? The red light that follows is not failure. It is the mirror asking: are you sure?

Most developers skip this step. They write the code, make it work, then write tests to document the behavior they already believe in. The tests pass, because of course they pass — the code was written to produce exactly those results. The mirror is no longer a mirror. It is a painting of what you wanted to see.

---

There is something uncomfortable in this, if you sit with it long enough.

If the value of tests is in exposing the gap between belief and reality, then the tests you write after you already know the answer are... decorative. They confirm what you trust. They do not challenge it.

And confidence in software is a liability, not an asset. The system that you understand the best is the one most likely to surprise you, because you have stopped looking.

The stoic practice here is not anxiety. It is regular attention. Return to the mirror. Look again. Not because you expect to find something wrong, but because certainty is a form of sleep.

---

What is the last thing you were certain about in your codebase, that later turned out to be something else entirely?
