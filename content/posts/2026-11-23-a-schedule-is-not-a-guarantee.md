+++
title = "A Schedule Is Not a Guarantee"
date = 2026-11-23
description = "Automation can begin work on time. Reliability requires someone or something to prove that the work finished."
[taxonomies]
tags = ["software", "automation", "reliability", "discipline", "tolkien"]
[extra]
cover = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80&auto=format&fit=crop"
+++

A schedule can start work. It cannot guarantee an outcome.

This distinction disappears easily when automation becomes routine. A job runs every Monday, a backup begins every night, a deployment starts after every merge. Soon the timetable is treated as evidence that the result exists. But a trigger proves only that something was asked to happen. The process may stall, lose authority, publish half an artifact, or finish successfully without reaching the place anyone depends on.

Reliable automation needs a completion contract. Define the outcome, verify it at the boundary where it matters, and make failure visible to someone able to act. A green process exit may prove that files were generated. It does not prove that the public site serves them. A successful backup command does not prove that the archive can be restored. The final check should resemble the promise made to the user.

Gondor's beacons carry urgency across the mountains, but fire on Amon Dîn does not place the Rohirrim on the Pelennor. The signal must be seen, understood, accepted, and answered. Tolkien makes the distance between summons and aid painfully concrete. Each beacon matters because people remain responsible for what happens after it is lit.

This is not an argument for watching every task by hand. Good systems watch themselves. They preserve a receipt, test the resulting state, retry only when repetition is safe, and escalate when judgment is required. Human attention should meet exceptions, not hover over healthy machinery.

Automation removes repeated effort. It does not remove ownership. If nobody can tell whether the promise was kept, the schedule is only a ritual with a timestamp.
