import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { db, usersTable } from "@workspace/db";

export async function requireCarePathUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your CarePath account." });
    return;
  }
  if (res.locals.carepathUser?.id === userId) {
    next();
    return;
  }

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const primaryEmail =
      clerkUser.emailAddresses.find(
        (address) => address.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
    if (!primaryEmail) {
      res.status(403).json({ error: "A verified email address is required." });
      return;
    }

    const email = primaryEmail.trim().toLowerCase();
    const adminEmails = new Set(
      (process.env.CAREPATH_ADMIN_EMAILS ?? "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0] ||
      "CarePath member";
    const [user] = await db
      .insert(usersTable)
      .values({
        id: userId,
        email,
        name,
        role: adminEmails.has(email) ? "admin" : "user",
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          email,
          role: adminEmails.has(email) ? "admin" : "user",
          updatedAt: new Date(),
        },
      })
      .returning();

    res.locals.carepathUser = user;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Unable to verify CarePath account");
    res.status(401).json({ error: "Unable to verify your signed-in account." });
  }
}

export function requireCarePathAdmin(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.locals.carepathUser?.role !== "admin") {
    res.status(403).json({ error: "CarePath administrator access is required." });
    return;
  }
  next();
}