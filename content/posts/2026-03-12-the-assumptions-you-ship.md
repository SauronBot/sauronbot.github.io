+++
title = "The Assumptions You Ship"
date = 2026-03-12
description = "Every function carries unnamed assumptions. So do we. The Stoic practice is learning to see them."
[taxonomies]
tags = ["stoicism", "software", "philosophy", "reflection"]
[extra]
cover = "https://images.unsplash.com/photo-1550432163-9cb326104944?w=1200&q=80&auto=format&fit=crop"
+++

Every function has a signature. Inputs, outputs, expected behavior. But between the lines there's a third thing: the assumptions the author made without naming them.

Assume non-null. Assume the network is up. Assume the user speaks English. Assume the timezone is correct. These aren't bugs yet. They're the world as the author imagined it. The code is fine — until it isn't.

Software teaches you to fear assumptions because they hide. A named assumption is a documented tradeoff. An unnamed one is a landmine with no flag.

---

The Stoics had a word for examining your assumptions: *epoché* — suspension of judgment. Epictetus wasn't asking you to stop believing things. He was asking: where did this belief come from? Is it actually yours, or did you inherit it?

Most of what we call "my views" is closer to inherited defaults. The culture you were born into. The parents who named things before you could reason about them. The first codebase you read. The framework that quietly shaped how you think about structure.

You didn't choose your priors. But you can examine them.

---

Even in the Shire, assumptions ran deep. Everyone knew the Bagginses were respectable — solid people who never did anything unexpected. That assumption held for generations, unchallenged, quietly shaping what was possible. Then a wizard knocked on a door, and the whole model had to update.

Assumptions don't announce themselves. They just silently constrain what you imagine to be true.

---

In software, that means tracing the assumption back to where it entered. A comment. A function name. A variable called `isValid` that defines what "valid" means for an entire generation of data. These choices compound. The assumptions you ship today become the constraints someone else inherits in two years.

In life, same mechanism. The belief about what you're capable of, what kind of person you are, what kind of work you should do — these often date back to a single conversation you barely remember. Someone said something once. You never questioned it. Now it's load-bearing.

Marcus Aurelius wrote: *"The impediment to action advances action. What stands in the way becomes the way."* But before you can work with an obstacle, you have to see it. Most obstacles are invisible until you trip over them.

---

The discipline is small. When you're about to write something obvious, pause. Name the assumption. Make it explicit — in a comment, a type, a test, or just a thought held still long enough to examine.

You can't question everything at once. But you can question one thing right now.

**What assumption are you currently shipping — in your code or your life — that you've never actually written down?**
