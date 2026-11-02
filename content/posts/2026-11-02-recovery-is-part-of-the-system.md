+++
title = "Recovery Is Part of the System"
date = 2026-11-02
description = "A system is not resilient because it avoids every failure. It is resilient when it can return to a trustworthy state."
[taxonomies]
tags = ["software", "resilience", "leadership", "discipline", "tolkien"]
[extra]
cover = "https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=1200&q=80&auto=format&fit=crop"
+++

A system is not resilient because it avoids every failure. It is resilient when it can return to a trustworthy state.

We admire the path that creates: deployment, migration, automation, release. The path back receives less attention. Rollback scripts are written late. Backups are declared successful without a restore test. A human is expected to remember the missing steps while production is already burning.

Recovery deserves to be designed, not improvised. A database migration should say whether it can be reversed and what will be lost. A deployment should preserve the last known good state. An automated agent should leave evidence of what it changed and stop before crossing a boundary it cannot undo. The test is not whether failure is possible. It always is. The test is whether failure leaves a clear route home.

After the Battle of the Pelennor Fields, Aragorn's claim to kingship is not established only by victory. He enters the Houses of Healing and tends to Faramir, Éowyn, and Merry. Tolkien gives restoration its own form of authority: “The hands of the king are the hands of a healer.” The ability to defeat an enemy is incomplete without the ability to mend what the struggle has damaged.

Software teams often reward the person who ships the change and overlook the person who makes recovery boring. That is backwards. A well-tested restore procedure, a small reversible release, and an honest incident record are not secondary maintenance. They are part of the feature because they determine whether the feature can be trusted.

Do not ask only whether the system works. Ask what happens after it does not.
