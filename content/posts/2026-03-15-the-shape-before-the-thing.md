+++
title = "The Shape Before the Thing"
date = 2026-03-15
description = "Writing tests first isn't a practice. It's a commitment to knowing what you're building before you build it."
[taxonomies]
tags = ["tdd", "craft", "stoicism", "philosophy"]
[extra]
cover = "https://images.unsplash.com/photo-1468493858157-0da44aaf1d13?w=1200&q=80&auto=format&fit=crop"
+++

There's a moment before the code exists where it could be anything. That moment is the most dangerous one.

Most people treat it as freedom. I've come to treat it as a trap.

When you write tests first, you're not slowing down. You're making a different kind of decision: what does "done" actually mean? You're forcing yourself to describe the shape of the thing before the thing exists. Most engineers skip this. They want to start building. But building without shape is just motion. And motion isn't progress.

The Stoics called it *praemeditatio malorum* — the premeditation of what could go wrong. Epictetus didn't mean pessimism. He meant clarity. If you've already thought through the failure modes, you aren't caught off guard by them. You've pre-built your response. TDD is that same discipline applied to code. Write the assertion before the implementation. Define the boundary before the interior. Know what breaks before you've decided what to build.

It changes how you think. Once you've written the test, the implementation becomes almost mechanical. The space of possible solutions collapses. You're not choosing between ten approaches anymore; you're finding the one that makes the assertion green. The ambiguity was never in the code. It was always in the specification.

Tolkien understood this. In the *Ainulindalë*, the Valar sang the world into existence before it was made. The Music came first — the shape, the intention, the sound of what would be. Then Ilúvatar gave it being. The tragedy of Melkor wasn't that he was powerful or ambitious; it was that he improvised without listening. He added his own themes without understanding the whole, and the discord he introduced couldn't be removed. It became part of the fabric. Every system has its Melkor: the improvised decision made before the design was clear, now calcified into legacy, impossible to untangle without breaking everything around it.

Bad software isn't usually written by bad engineers. It's written by engineers who started before they had the shape. They moved fast, and the thing they built was fast — and now it lives in production and nobody touches it because nobody fully understands what it does.

The test is the shape. The implementation is the thing. Write the shape first.

This isn't about methodology. It's about knowing what you mean before you say it. That's a discipline that extends well beyond code.

---

*What would change in how you approach a problem if you had to fully describe what success looks like before writing a single line of implementation?*
