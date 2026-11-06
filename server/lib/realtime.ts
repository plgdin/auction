import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { loadUser } from "./auth";

type Client = {
  socket: WebSocket;
  userId: string | null;
  role: string;
  auctions: Set<string>;
};

const clients = new Set<Client>();
let wss: WebSocketServer | null = null;

export function initRealtime(server: Server) {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get("token") || "";
    void (async () => {
      const user = token ? await loadUser(token) : null;
      wss?.handleUpgrade(request, socket, head, (ws) => {
        const client: Client = {
          socket: ws,
          userId: user?.id ?? null,
          role: user?.role ?? "guest",
          auctions: new Set(),
        };
        clients.add(client);
        ws.on("message", (raw) => {
          try {
            const message = JSON.parse(raw.toString()) as {
              type?: string;
              auctionId?: string;
            };
            if (message.type === "subscribe" && message.auctionId) {
              client.auctions.add(message.auctionId);
            }
            if (message.type === "unsubscribe" && message.auctionId) {
              client.auctions.delete(message.auctionId);
            }
            if (message.type === "ping") {
              ws.send(JSON.stringify({ type: "pong", now: new Date().toISOString() }));
            }
          } catch {
            /* Ignore malformed socket messages. */
          }
        });
        ws.on("close", () => clients.delete(client));
        ws.on("error", () => clients.delete(client));
        ws.send(JSON.stringify({ type: "connected", now: new Date().toISOString() }));
      });
    })();
  });

  return wss;
}

function send(client: Client, payload: unknown) {
  if (client.socket.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify(payload));
  }
}

export function broadcastAuction(auctionId: string, payload: unknown) {
  for (const client of clients) {
    if (client.auctions.has(auctionId)) send(client, payload);
  }
}

export function broadcastAll(payload: unknown) {
  for (const client of clients) send(client, payload);
}

export function sendToUser(userId: string, payload: unknown) {
  for (const client of clients) {
    if (client.userId === userId) send(client, payload);
  }
}
