type SSEClient = {
  controller: ReadableStreamDefaultController<string>;
  pingInterval: ReturnType<typeof setInterval>;
};

const clients: SSEClient[] = [];

function formatEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function subscribe(): Response {
  let client: SSEClient | null = null;
  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(': connected\n\n');
      const pingInterval = setInterval(() => {
        try { controller.enqueue(': ping\n\n'); }
        catch { if (client) clearInterval(client.pingInterval); }
      }, 15000);
      client = { controller, pingInterval };
      clients.push(client);
    },
    cancel() {
      if (!client) return;
      clearInterval(client.pingInterval);
      const index = clients.indexOf(client);
      if (index >= 0) clients.splice(index, 1);
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}

export function publish(event: string, data: unknown) {
  const message = formatEvent(event, data);
  for (const [index, client] of clients.entries()) {
    try { client.controller.enqueue(message); }
    catch {
      clearInterval(client.pingInterval);
      clients.splice(index, 1);
    }
  }
}
