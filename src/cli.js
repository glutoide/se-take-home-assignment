import readline from 'node:readline';
import { OrderController } from './order-controller.js';
import { handleCommand } from './command-handler.js';

function timestamp() {
  return new Date().toTimeString().slice(0, 8);
}

function log(message) {
  console.log(`${timestamp()} ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  const controller = new OrderController();

  for (const command of ['normal', 'vip', 'status', '+bot', 'status']) {
    const result = handleCommand(controller, command);
    log(result.message);
  }

  await sleep(10_100);
  log(handleCommand(controller, 'status').message);
  await sleep(10_100);
  log(handleCommand(controller, 'status').message);
}

function runInteractive() {
  const controller = new OrderController();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  log('Commands: normal, vip, +bot, -bot, status, help, exit');

  const prompt = () => {
    if (process.stdin.isTTY) process.stdout.write(`${timestamp()} > `);
  };

  prompt();
  rl.on('line', (line) => {
    const result = handleCommand(controller, line);
    log(result.message);
    if (result.exit) rl.close();
    else prompt();
  });
}

if (process.argv.includes('--demo')) {
  await runDemo();
} else {
  runInteractive();
}
