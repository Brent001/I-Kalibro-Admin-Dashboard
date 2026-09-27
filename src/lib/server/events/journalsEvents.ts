// Simple in-memory SSE broadcaster for journal events
// Note: this uses module-scoped state and works for single-process deployments.

type SSEClient = {
  controller: ReadableStreamDefaultController<string>;
  pingInterval: NodeJS.Timeout;
};

const clients: SSEClient[] = [];

function formatEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function subscribe() {
  let client: SSEClient | null = null;

  const stream = new ReadableStream<string>({
    start(controller) {
      // Send initial connection message
      controller.enqueue(': connected\n\n');

      // Set up keep-alive ping
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(': ping\n\n');
        } catch (e) {
          console.debug('Ping failed:', e);
        }
      }, 15000);

      client = { controller, pingInterval };
      clients.push(client);
    },
    cancel() {
      if (client) {
        clearInterval(client.pingInterval);
        const idx = clients.indexOf(client);
        if (idx !== -1) {
          clients.splice(idx, 1);
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}

export function publish(event: string, data: unknown) {
  const message = formatEvent(event, data);
  const deadClients: number[] = [];

  clients.forEach((client, idx) => {
    try {
      client.controller.enqueue(message);
    } catch (e) {
      // Mark for cleanup
      deadClients.push(idx);
    }
  });

  // Remove dead clients in reverse order to preserve indices
  deadClients.reverse().forEach(idx => {
    const client = clients[idx];
    if (client) {
      clearInterval(client.pingInterval);
      clients.splice(idx, 1);
    }
  });
}

export function getConnectionCount() {
  return clients.length;
}

export default { subscribe, publish, getConnectionCount };
