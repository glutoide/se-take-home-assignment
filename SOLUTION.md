# FeedMe Software Engineer Take-Home — Backend Solution

A small in-memory Node.js order controller implementing the FeedMe/McDonald's cooking-bot assignment.

## Technical choice

- **Node.js 22**, CommonJS, no runtime dependencies.
- The core `OrderController` owns order priority, bot lifecycle, timers, and immutable snapshots.
- The CLI is a thin adapter around the controller so the business logic can be tested deterministically.
- Production processing time is fixed at **10,000 ms per order**.
- No persistence is used, as requested by the assignment.

This intentionally avoids a web framework, database, container, or extra infrastructure because none are required for the prototype.

## Requirement mapping

1. `normal` creates a unique increasing NORMAL order and places it in PENDING.
2. `vip` creates a VIP order ahead of all pending NORMAL orders and behind older VIP orders.
3. Order IDs are unique and monotonically increasing from 1.
4. `+bot` creates a bot that immediately takes the highest-priority pending order. A real timer moves it to COMPLETE after 10 seconds, then the bot takes the next order.
5. With no pending work, bots are IDLE and immediately pick up a later order.
6. `-bot` removes the newest bot. If it was processing an order, its timer is cancelled and the order is reinserted using original submission order within its VIP/NORMAL priority class.
7. All state lives in memory.

## Interactive CLI

```bash
node src/cli.js
```

Commands:

```text
normal     create a normal order
vip        create a VIP order
+bot       add a cooking bot
-bot       remove the newest cooking bot
status     print PENDING / COMPLETE / bot state
help       print commands
exit       exit the CLI
```

Every CLI output line starts with a local-time `HH:MM:SS` timestamp.

## Employer scripts

The repository's official `backend-verify-result` workflow executes the `scripts/` directory (plural), so the solution follows that executable acceptance contract.

```bash
./scripts/test.sh
./scripts/build.sh
./scripts/run.sh
```

- `test.sh` runs the Node test suite.
- `build.sh` syntax-checks the source and stages the CLI into `dist/`.
- `run.sh` executes a real demo with the default 10-second processing duration and writes meaningful timestamped output to `scripts/result.txt`.

## Tests

The suite covers:

- VIP priority and FIFO within VIP/NORMAL classes;
- unique increasing order IDs;
- exact 10-second completion boundary using a deterministic scheduler;
- idle bot pickup;
- automatic next-order processing;
- parallel bots with one order per bot;
- removal of the newest bot;
- cancellation of an interrupted bot timer;
- reinsertion of an interrupted order into its original priority/FIFO position;
- safe removal when no bot exists;
- a real child-process interactive CLI smoke test with stdin commands and timestamp validation;
- prompt CLI shutdown even if a bot still has an active processing timer.

Run:

```bash
npm test
```

## Assumptions / ambiguity decisions

- A VIP order does **not preempt** an order already being cooked; it only has priority over orders still in PENDING.
- “Return to its original position” is interpreted as preserving the interrupted order's original submission sequence inside its priority class. This keeps VIP-before-NORMAL and FIFO stable even if new orders arrive while it is processing.
- The assignment prose mentions a `script` directory, while the employer's actual GitHub Action invokes `scripts/test.sh`, `scripts/build.sh`, `scripts/run.sh` and checks `scripts/result.txt`; the implementation follows the workflow's `scripts/` path.
