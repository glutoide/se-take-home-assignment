#!/usr/bin/env node
import readline from 'node:readline';
import { OrderController } from './order-controller.js';

const timestamp = () => new Date().toTimeString().slice(0, 8);
const formatOrder = (order) => `#${order.number} ${order.type}`;
const log = (message) => process.stdout.write(`[${timestamp()}] ${message}\n`);

const controller = new OrderController({
  processTimeMs: Number(process.env.ORDER_PROCESS_MS || 10_000),
  onEvent(event) {
    if (event.type === 'ORDER_CREATED') log(`${event.order.type} order #${event.order.number} created -> PENDING`);
    if (event.type === 'BOT_ADDED') log(`Bot #${event.botId} added`);
    if (event.type === 'ORDER_STARTED') log(`${event.order.type} order #${event.order.number} started by Bot #${event.botId}`);
    if (event.type === 'ORDER_COMPLETED') log(`Order #${event.order.number} COMPLETE by Bot #${event.botId}`);
    if (event.type === 'ORDER_RETURNED') log(`Order #${event.order.number} returned to PENDING from Bot #${event.botId}`);
    if (event.type === 'BOT_REMOVED') log(`Bot #${event.botId} removed`);
  },
});

function printStatus() {
  const state = controller.getState();
  const pending = state.pending.length ? state.pending.map(formatOrder).join(', ') : 'empty';
  const complete = state.complete.length ? state.complete.map(formatOrder).join(', ') : 'empty';
  const bots = state.bots.length
    ? state.bots.map((bot) => bot.status === 'BUSY'
      ? `#${bot.id} BUSY(${formatOrder(bot.order)})`
      : `#${bot.id} IDLE`).join(', ')
    : 'empty';

  log(`PENDING: ${pending}`);
  log(`BOTS: ${bots}`);
  log(`COMPLETE: ${complete}`);
}

async function handleCommand(raw) {
  const command = raw.trim().toLowerCase();
  if (!command) return false;

  if (command === 'normal') controller.addOrder('NORMAL');
  else if (command === 'vip') controller.addOrder('VIP');
  else if (command === '+bot') controller.addBot();
  else if (command === '-bot') {
    if (!controller.removeBot()) log('No bot to remove');
  } else if (command === 'status') printStatus();
  else if (command.startsWith('wait ')) {
    const ms = Number(command.slice(5));
    if (!Number.isFinite(ms) || ms < 0) log('Usage: wait <milliseconds>');
    else await new Promise((resolve) => setTimeout(resolve, ms));
  } else if (command === 'help') log('Commands: normal, vip, +bot, -bot, status, wait <ms>, help, exit');
  else if (command === 'exit') {
    controller.shutdown();
    return true;
  } else log(`Unknown command: ${raw.trim()}`);

  return false;
}

const rl = readline.createInterface({ input: process.stdin, terminal: Boolean(process.stdin.isTTY) });
let chain = Promise.resolve();
let exiting = false;

if (process.stdin.isTTY) {
  log('Order Controller CLI');
  log('Commands: normal, vip, +bot, -bot, status, wait <ms>, help, exit');
}

rl.on('line', (line) => {
  chain = chain.then(async () => {
    if (exiting) return;
    exiting = await handleCommand(line);
    if (exiting) rl.close();
  });
});

rl.on('close', () => {
  chain.catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
});
