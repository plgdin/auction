import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { config } from "../config";
import { one, query } from "../db";
import { forbidden, unauthorized } from "./errors";

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "admin";
  is_seller: boolean;
  is_blocked: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    config.authSecret,
    { expiresIn: "7d", issuer: "lelam.co" },
  );
}

export function hashIp(value: string) {
  return crypto.createHmac("sha256", config.authSecret).update(value).digest("hex");
}

export function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

export async function loadUser(token: string): Promise<AuthUser | null> {
  try {
    const payload = jwt.verify(token, config.authSecret, { issuer: "lelam.co" }) as {
      sub?: string;
    };
    if (!payload.sub) return null;
    const user = await one<AuthUser>(
      `select id, email, full_name, role, is_seller, is_blocked
       from profiles where id = $1`,
      [payload.sub],
    );
    return user;
  } catch {
    return null;
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const user = await loadUser(header.slice(7).trim());
    if (user && !user.is_blocked) req.user = user;
  }
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.is_blocked) return next(forbidden("This account is blocked."));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "admin") return next(forbidden("Administrator access required."));
  next();
}

export async function recordAuthAttempt(email: string, ipHash: string, success: boolean) {
  await query(
    "insert into auth_attempts (email, ip_hash, success) values ($1, $2, $3)",
    [email, ipHash, success],
  );
}

export async function recentFailedAttempts(email: string, ipHash: string, minutes = 15) {
  const rows = await one<{ count: string }>(
    `select count(*)::text as count from auth_attempts
     where success = false and created_at > now() - ($1 || ' minutes')::interval
       and (email = $2 or ip_hash = $3)`,
    [minutes, email, ipHash],
  );
  return Number(rows?.count || 0);
}
