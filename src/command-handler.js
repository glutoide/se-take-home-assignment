function formatOrders(orders) {
  return orders.length ? orders.map((order) => `${order.type}#${order.number}`).join(', ') : '-';
}

function formatBots(bots) {
  return bots.length
    ? bots.map((bot) => `#${bot.id} ${bot.status}${bot.orderNumber ? ` order#${bot.orderNumber}` : ''}`).join(', ')
    : '-';
}

export function formatState(state) {
  return `PENDING: ${formatOrders(state.pending)} | COMPLETE: ${formatOrders(state.complete)} | BOTS: ${formatBots(state.bots)}`;
}

export function handleCommand(controller, rawCommand) {
  const command = rawCommand.trim().toLowerCase();

  switch (command) {
    case 'normal': {
      const order = controller.addOrder('NORMAL');
      return { message: `Normal order #${order.number} created`, exit: false };
    }
    case 'vip': {
      const order = controller.addOrder('VIP');
      return { message: `VIP order #${order.number} created`, exit: false };
    }
    case '+bot': {
      const botId = controller.addBot();
      return { message: `Bot #${botId} created`, exit: false };
    }
    case '-bot': {
      const botId = controller.removeBot();
      return {
        message: botId === null ? 'No bot to remove' : `Bot #${botId} removed`,
        exit: false,
      };
    }
    case 'status':
      return { message: formatState(controller.getState()), exit: false };
    case 'help':
      return { message: 'Commands: normal, vip, +bot, -bot, status, help, exit', exit: false };
    case 'exit':
      return { message: 'Bye', exit: true };
    default:
      return { message: `Unknown command: ${rawCommand.trim() || '(empty)'}`, exit: false };
  }
}
