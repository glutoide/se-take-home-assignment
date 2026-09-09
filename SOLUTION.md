# Backend solution

This submission uses Node.js 22 and only built-in modules. The prototype keeps all state in memory as requested.

## Design

- `src/order-controller.js` owns the pending queue, completed orders, bot lifecycle, 10-second processing timers, and order numbering.
- VIP orders are ordered before normal orders; FIFO is preserved within each priority by the increasing order number.
- Removing a bot always removes the newest bot. If it was processing an order, its timer is cancelled and the order is reinserted according to its original priority/FIFO position.
- `src/command-handler.js` maps the interactive commands to controller operations.
- `src/cli.js` provides the compulsory interactive CLI and a deterministic demo mode used by `scripts/run.sh`.

## Interactive commands

```text
normal
vip
+bot
-bot
status
help
exit
```

Run it with:

```bash
npm start
```

## Verification

```bash
./scripts/test.sh
./scripts/build.sh
./scripts/run.sh
```

`test.sh` uses Node's built-in test runner and covers order creation, VIP/normal priority, FIFO, 10-second bot processing, idle behavior, newest-bot removal with interrupted-order restoration, command handling, and stdin-driven interactive CLI behavior.

`build.sh` performs syntax checks and packages the CLI into `dist/`. `run.sh` executes the packaged CLI demo and writes timestamped output to `scripts/result.txt`.

No persistence, database, web framework, or external runtime dependency is used because none is needed for this prototype.
