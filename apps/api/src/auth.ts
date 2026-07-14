import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config";
import { pool } from "./db";

const key = new TextEncoder().encode(config.jwtSecret);
export const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");
export const recoveryCode = () => randomBytes(12).toString("base64url");
export const shortCode = () => randomBytes(4).toString("hex").slice(0, 6).toUpperCase();

export async function playerToken(playerId: string, version: number) {
  return new SignJWT({ type: "player", version }).setProtectedHeader({ alg: "HS256" }).setSubject(playerId).setIssuedAt().setExpirationTime("180d").sign(key);
}

export async function attemptToken(attemptId: string, playerId: string, expiresAt: Date) {
  return new SignJWT({ type: "attempt", playerId }).setProtectedHeader({ alg: "HS256" }).setSubject(attemptId).setIssuedAt().setExpirationTime(Math.floor(expiresAt.getTime() / 1000)).sign(key);
}

export async function verifyToken(token: string) {
  return (await jwtVerify(token, key)).payload;
}

export async function requirePlayer(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer /, "");
  if (!token) throw Object.assign(new Error("需要玩家身份"), { statusCode: 401 });
  const payload = await verifyToken(token);
  if (payload.type !== "player" || !payload.sub) throw Object.assign(new Error("无效身份"), { statusCode: 401 });
  const version = Number(payload.version);
  const current = await pool.query("SELECT 1 FROM players WHERE id=$1 AND credential_version=$2", [payload.sub, version]);
  if (!current.rowCount) throw Object.assign(new Error("身份已失效，请使用恢复码重新登录"), { statusCode: 401 });
  return { id: payload.sub, version };
}
