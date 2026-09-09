const readline = require('node:readline');
const { OrderController } = require('./order-controller');

function timestamp(date = new Date()) {
  return date.toISOString().slice(11, 19);
}

function stateSummary(controller) {
  const state = controller.snapshot();
  return JSON.stringify({
    pending: state.pending.map(({ id, type }) => ({ id, type })),
    complete: state.complete.map(({ id, type }) => ({ id, type })),
    bots: state.bots.map(({ id, status, orderId }) => ({ id, status, orderId })),
  });
}

function executeCommand(controller, input, log = console.log) {
  const command = input.trim().toLowerCase();

  switch (command) {
    case 'normal': {
      const order = controller.addOrder('NORMAL');
      log(`created NORMAL order #${order.id}`);
      break;
    }
    case 'vip': {
      const order = controller.addOrder('VIP');
      log(`created VIP order #${order.id}`);
      break;
    }
    case '+bot': {
      const bot = controller.addBot();
      log(`added bot #${bot.id}`);
      break;
    }
    case '-bot': {
      const bot = controller.removeBot();
      log(bot ? `removed bot #${bot.id}` : 'no bot to remove');
      break;
    }
    case 'status':
      log(`status ${stateSummary(controller)}`);
      break;
    case 'help':
      log('commands: normal, vip, +bot, -bot, status, help, exit');
      break;
    case 'exit':
      return false;
    default:
      log(`unknown command: ${input.trim()}`);
  }

  return true;
}

function createTimestampLogger(write = (line) => process.stdout.write(`${line}\n`)) {
  return (message) => write(`${timestamp()} ${message}`);
}

async function runDemo() {
  const controller = new OrderController();
  const log = createTimestampLogger();
  log('demo started');
  executeCommand(controller, 'normal', log);
  executeCommand(controller, 'normal', log);
  executeCommand(controller, 'vip', log);
  executeCommand(controller, '+bot', log);
  executeCommand(controller, '+bot', log);
  executeCommand(controller, 'status', log);
  await new Promise((resolve) => setTimeout(resolve, 10_100));
  executeCommand(controller, 'status', log);
  log('demo completed');
}

function runInteractive() {
  const controller = new OrderController();
  const log = createTimestampLogger();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
  log('interactive order controller ready; type help for commands');
  rl.prompt();
  rl.on('line', (line) => {
    if (!executeCommand(controller, line, log)) {
      rl.close();
      return;
    }
    rl.prompt();
  });
}

if (require.main === module) {
  if (process.argv.includes('--demo')) {
    runDemo().catch((error) => {
      console.error(`${timestamp()} demo failed: ${error.message}`);
      process.exitCode = 1;
    });
  } else {
    runInteractive();
  }
}

module.exports = { executeCommand, stateSummary, timestamp };
