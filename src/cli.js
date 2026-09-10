#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { OrderController } = require('./order-controller');

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function log(message) {
  process.stdout.write(`${timestamp()} ${message}\n`);
}

function formatEvent(event) {
  switch (event.type) {
    case 'order-created':
      return `Order #${event.orderId} ${event.orderType} -> PENDING`;
    case 'bot-created':
      return `Bot #${event.botId} created`;
    case 'order-started':
      return `Bot #${event.botId} started ${event.orderType} order #${event.orderId}`;
    case 'order-completed':
      return `Order #${event.orderId} ${event.orderType} -> COMPLETE by Bot #${event.botId}`;
    case 'bot-idle':
      return `Bot #${event.botId} -> IDLE`;
    case 'order-requeued':
      return `Order #${event.orderId} ${event.orderType} -> PENDING (Bot #${event.botId} removed)`;
    case 'bot-removed':
      return `Bot #${event.botId} removed`;
    default:
      return `Event: ${event.type}`;
  }
}

function printSnapshot(controller) {
  const snapshot = controller.getSnapshot();
  const pending = snapshot.pending.map((order) => `${order.type} #${order.id}`).join(', ');
  const complete = snapshot.complete.map((order) => `${order.type} #${order.id}`).join(', ');
  const bots = snapshot.bots.map((bot) => {
    if (bot.status === 'PROCESSING') return `#${bot.id} PROCESSING order #${bot.orderId}`;
    return `#${bot.id} IDLE`;
  }).join(', ');

  log(`PENDING: [${pending}]`);
  log(`COMPLETE: [${complete}]`);
  log(`BOTS: [${bots}]`);
}

function createController() {
  return new OrderController({ onEvent: (event) => log(formatEvent(event)) });
}

function handleCommand(controller, rawCommand) {
  const command = rawCommand.trim().toLowerCase();
  switch (command) {
    case 'normal':
    case 'new-normal':
      controller.addNormalOrder();
      return true;
    case 'vip':
    case 'new-vip':
      controller.addVipOrder();
      return true;
    case '+bot':
    case 'add-bot':
      controller.addBot();
      return true;
    case '-bot':
    case 'remove-bot': {
      const removed = controller.removeBot();
      if (!removed) log('No bot to remove');
      return true;
    }
    case 'status':
      printSnapshot(controller);
      return true;
    case 'help':
      log('Commands: normal, vip, +bot, -bot, status, help, exit');
      return true;
    case 'exit':
    case 'quit':
      return false;
    case '':
      return true;
    default:
      log(`Unknown command: ${rawCommand.trim()}`);
      log('Commands: normal, vip, +bot, -bot, status, help, exit');
      return true;
  }
}

async function runInteractive() {
  const controller = createController();
  log('FeedMe Order Controller ready. Type help for commands.');

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!handleCommand(controller, line)) {
      rl.close();
      break;
    }
  }
  controller.shutdown();
}

async function runDemo() {
  const controller = createController();
  log('Demo start');
  controller.addNormalOrder();
  controller.addVipOrder();
  printSnapshot(controller);
  controller.addBot();
  controller.addBot();
  printSnapshot(controller);
  await new Promise((resolve) => setTimeout(resolve, 10_100));
  printSnapshot(controller);
  log('Demo complete');
}

async function main() {
  if (process.argv.includes('--demo')) await runDemo();
  else await runInteractive();
}

if (require.main === module) {
  main().catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { formatEvent, handleCommand, printSnapshot, runDemo, runInteractive, timestamp };
