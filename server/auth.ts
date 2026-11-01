import type { Request, Response, NextFunction } from "express";
import type { Express } from "express";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import type { User } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

/** Strip the password hash — never send it to the client. */
export function safeUser(user: User) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/** Minimal public profile: what any signed-in user may see about another user. */
export function publicUser(user: User) {
  return { id: user.id, name: user.name, role: user.role, avatar: user.avatar };
}

export function currentUser(req: Request): User | undefined {
  const id = req.session.userId;
  return id ? storage.getUser(id) : undefined;
}

/** 401 when there is no signed-in session. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not signed in" });
  }
  next();
}

/** 401 when signed out, 403 when the signed-in user lacks one of the roles. */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ message: "Not signed in" });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

/**
 * True when the signed-in user is the resource owner (by id) or an admin.
 * Used for per-route ownership checks throughout routes.ts.
 */
export function selfOrAdmin(req: Request, ownerId: number): boolean {
  const user = currentUser(req);
  return !!user && (user.role === "admin" || user.id === ownerId);
}

const MIN_PASSWORD_LENGTH = 8;

export function registerAuthRoutes(app: Express) {
  // ─── Register (guests and owners only; admins are created out-of-band) ───
  app.post("/api/auth/register", (req, res) => {
    const { name, email, password, role } = req.body ?? {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const cleanEmail = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Invalid email address" });
    }
    if (storage.getUserByEmail(cleanEmail)) {
      return res.status(409).json({ message: "Email is already registered" });
    }
    const cleanRole = role === "owner" ? "owner" : "guest";
    const user = storage.createUser({
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash: bcrypt.hashSync(password, 10),
      role: cleanRole,
    });
    req.session.userId = user.id;
    res.status(201).json(safeUser(user));
  });

  // ─── Login ───
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body ?? {};
    const user = email ? storage.getUserByEmail(String(email).toLowerCase().trim()) : undefined;
    const ok =
      !!user &&
      !!user.passwordHash &&
      typeof password === "string" &&
      bcrypt.compareSync(password, user.passwordHash);
    if (!ok) {
      // Same message either way: don't reveal which half was wrong.
      return res.status(401).json({ message: "Invalid email or password" });
    }
    req.session.userId = user.id;
    res.json(safeUser(user));
  });

  // ─── Logout ───
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Could not sign out" });
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // ─── Current session ───
  app.get("/api/auth/me", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ message: "Not signed in" });
    res.json(safeUser(user));
  });
}
