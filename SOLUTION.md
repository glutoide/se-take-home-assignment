# Backend solution

A dependency-free Node.js CLI implementation of the FeedMe order controller.

## Design

- Orders are kept in memory and receive monotonically increasing IDs.
- Pending orders are ordered by priority (`VIP` before `NORMAL`) and then by order ID, which also restores a cancelled order to its original FIFO position.
- Each bot processes at most one order at a time for 10 seconds.
- Idle bots immediately pick up new pending work.
- Removing a bot always removes the newest bot; an in-flight order is cancelled and re-queued with its original priority/FIFO position.
- Timers are injected into the controller, so unit tests verify the 10-second lifecycle without sleeping.

## Commands

Interactive mode:

```bash
npm start
```

Commands: `normal`, `vip`, `+bot`, `-bot`, `status`, `help`, `exit`.

## Verification

```bash
./scripts/test.sh
./scripts/build.sh
./scripts/run.sh
```

`run.sh` writes the demo output to `scripts/result.txt`. Every demo line begins with an `HH:MM:SS` timestamp.
