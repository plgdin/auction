import { query } from "../db";
import { sendToUser } from "./realtime";

export async function notify(
  userId: string,
  type: string,
  title: string,
  body = "",
  data: Record<string, unknown> = {},
) {
  const rows = await query<{ id: string; created_at: string }>(
    `insert into notifications (user_id, type, title, body, data)
     values ($1, $2, $3, $4, $5::jsonb) returning id, created_at`,
    [userId, type, title, body, JSON.stringify(data)],
  );
  const notification = rows[0];
  if (notification) {
    sendToUser(userId, { type: "notification", notification: { ...notification, type, title, body, data } });
  }
  return notification;
}

export async function notifyMany(
  userIds: string[],
  type: string,
  title: string,
  body = "",
  data: Record<string, unknown> = {},
) {
  await Promise.all([...new Set(userIds)].map((id) => notify(id, type, title, body, data)));
}
