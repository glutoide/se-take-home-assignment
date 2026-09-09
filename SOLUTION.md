# Backend submission — Node.js CLI

This solution implements the in-memory order controller as a dependency-free Node.js CLI.

## Run

```bash
./scripts/test.sh
./scripts/build.sh
./scripts/run.sh
```

For an interactive session:

```bash
node src/cli.js
```

Commands: `normal`, `vip`, `+bot`, `-bot`, `status`, `wait <ms>`, `help`, `exit`.

## Design

- VIP orders are queued before NORMAL orders; FIFO is preserved within each priority.
- Order numbers and bot IDs are monotonic.
- Each bot processes one order at a time for 10 seconds, then immediately takes the next pending order.
- Removing a bot removes the newest bot. Its in-progress order is reinserted according to original order number and VIP/NORMAL priority.
- State is intentionally in memory only, as required by the assignment.
- Timer functions are injectable for deterministic unit tests; the production CLI uses the required 10-second processing time by default.

The tests cover queue priority/FIFO, increasing IDs, bot dispatch, 10-second completion, idle bots, parallel bots, newest-bot removal, cancellation, requeueing, and interactive CLI output.
