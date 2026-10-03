import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CancelAppointmentParams,
  CancelAppointmentResponse,
  CreateAppointmentBody,
  CreateAppointmentResponse,
  CreateTokenBody,
  CreateTokenResponse,
  CreateVisitPlanBody,
  CreateVisitPlanResponse,
  DeleteVisitPlanParams,
  GetProfileResponse,
  ListAppointmentsResponse,
  ListTokensResponse,
  ListVisitPlansResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  UpdateVisitPlanBody,
  UpdateVisitPlanParams,
  UpdateVisitPlanResponse,
} from "@workspace/api-zod";
import {
  appointmentsTable,
  db,
  doctorsTable,
  hospitalSpecialtiesTable,
  hospitalsTable,
  specialtiesTable,
  tokensTable,
  usersTable,
  visitPlansTable,
} from "@workspace/db";
import { requireCarePathUser } from "../lib/auth";

const router: IRouter = Router();
router.use(requireCarePathUser);

const iso = (value: Date) => value.toISOString();

async function appointmentOutput(id: number) {
  const [row] = await db
    .select({
      appointment: appointmentsTable,
      hospitalName: hospitalsTable.name,
      specialty: specialtiesTable.name,
      doctorName: doctorsTable.name,
    })
    .from(appointmentsTable)
    .innerJoin(hospitalsTable, eq(appointmentsTable.hospitalId, hospitalsTable.id))
    .innerJoin(specialtiesTable, eq(appointmentsTable.specialtyId, specialtiesTable.id))
    .innerJoin(doctorsTable, eq(appointmentsTable.doctorId, doctorsTable.id))
    .where(eq(appointmentsTable.id, id))
    .limit(1);
  if (!row) return undefined;
  return {
    id: row.appointment.id,
    appointmentCode: row.appointment.appointmentCode,
    patientName: row.appointment.patientName,
    hospitalId: row.appointment.hospitalId,
    hospitalName: row.hospitalName,
    specialtyId: row.appointment.specialtyId,
    specialty: row.specialty,
    doctorId: row.appointment.doctorId,
    doctorName: row.doctorName,
    appointmentDate: row.appointment.appointmentDate,
    appointmentTime: row.appointment.appointmentTime,
    status: row.appointment.status === "cancelled" ? "cancelled" : "booked",
    isDemo: row.appointment.isDemo,
    createdAt: iso(row.appointment.createdAt),
  };
}

router.get("/profile", async (_req, res): Promise<void> => {
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  res.json(
    GetProfileResponse.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role === "admin" ? "admin" : "user",
      createdAt: iso(user.createdAt),
    }),
  );
});

router.patch("/profile", async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const [updated] = await db
    .update(usersTable)
    .set({ name: parsed.data.name.trim(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();
  res.json(
    UpdateProfileResponse.parse({
      id: updated!.id,
      name: updated!.name,
      email: updated!.email,
      role: updated!.role === "admin" ? "admin" : "user",
      createdAt: iso(updated!.createdAt),
    }),
  );
});

router.get("/appointments", async (_req, res): Promise<void> => {
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const rows = await db
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.userId, user.id))
    .orderBy(desc(appointmentsTable.appointmentDate), desc(appointmentsTable.createdAt));
  const appointments = await Promise.all(rows.map((row) => appointmentOutput(row.id)));
  res.json(ListAppointmentsResponse.parse(appointments.filter(Boolean)));
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const appointmentDate = body.appointmentDate.toISOString().slice(0, 10);
  if (appointmentDate < new Date().toISOString().slice(0, 10)) {
    res.status(400).json({ error: "Choose today or a future date." });
    return;
  }
  const [doctor] = await db
    .select({ id: doctorsTable.id })
    .from(doctorsTable)
    .where(
      and(
        eq(doctorsTable.id, body.doctorId),
        eq(doctorsTable.hospitalId, body.hospitalId),
        eq(doctorsTable.specialtyId, body.specialtyId),
        eq(doctorsTable.available, true),
      ),
    )
    .limit(1);
  if (!doctor) {
    res.status(400).json({ error: "Choose an available doctor at this hospital and specialty." });
    return;
  }
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      appointmentCode: `CP-${randomUUID().slice(0, 8).toUpperCase()}`,
      userId: user.id,
      patientName: body.patientName.trim(),
      hospitalId: body.hospitalId,
      specialtyId: body.specialtyId,
      doctorId: body.doctorId,
      appointmentDate,
      appointmentTime: body.appointmentTime,
      status: "booked",
      isDemo: true,
    })
    .returning();
  const result = await appointmentOutput(appointment!.id);
  res.status(201).json(CreateAppointmentResponse.parse(result));
});

router.patch("/appointments/:id/cancel", async (req, res): Promise<void> => {
  const parsed = CancelAppointmentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const [updated] = await db
    .update(appointmentsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(appointmentsTable.id, parsed.data.id),
        eq(appointmentsTable.userId, user.id),
        eq(appointmentsTable.status, "booked"),
      ),
    )
    .returning({ id: appointmentsTable.id });
  if (!updated) {
    res.status(404).json({ error: "Active appointment not found." });
    return;
  }
  res.json(CancelAppointmentResponse.parse(await appointmentOutput(updated.id)));
});

router.get("/tokens", async (_req, res): Promise<void> => {
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const rows = await db
    .select({
      token: tokensTable,
      hospitalName: hospitalsTable.name,
      specialty: specialtiesTable.name,
    })
    .from(tokensTable)
    .innerJoin(hospitalsTable, eq(tokensTable.hospitalId, hospitalsTable.id))
    .innerJoin(specialtiesTable, eq(tokensTable.specialtyId, specialtiesTable.id))
    .where(eq(tokensTable.userId, user.id))
    .orderBy(desc(tokensTable.createdAt));
  res.json(
    ListTokensResponse.parse(
      rows.map(({ token, hospitalName, specialty }) => ({
        id: token.id,
        tokenNumber: token.tokenNumber,
        hospitalId: token.hospitalId,
        hospitalName,
        specialtyId: token.specialtyId,
        specialty,
        waitingMinutes: token.waitingMinutes,
        status: token.status === "completed" ? "completed" : "active",
        isDemo: token.isDemo,
        createdAt: iso(token.createdAt),
      })),
    ),
  );
});

router.post("/tokens", async (req, res): Promise<void> => {
  const parsed = CreateTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [hospital] = await db
    .select()
    .from(hospitalsTable)
    .where(eq(hospitalsTable.id, parsed.data.hospitalId))
    .limit(1);
  const [specialtyLink] = await db
    .select()
    .from(hospitalSpecialtiesTable)
    .where(
      and(
        eq(hospitalSpecialtiesTable.hospitalId, parsed.data.hospitalId),
        eq(hospitalSpecialtiesTable.specialtyId, parsed.data.specialtyId),
      ),
    )
    .limit(1);
  if (!hospital || !specialtyLink) {
    res.status(400).json({ error: "Choose a specialty offered by this hospital." });
    return;
  }
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const [token] = await db
    .insert(tokensTable)
    .values({
      tokenNumber: `CP-${randomUUID().slice(0, 6).toUpperCase()}`,
      userId: user.id,
      hospitalId: hospital.id,
      specialtyId: parsed.data.specialtyId,
      waitingMinutes: hospital.waitingMinutes,
      status: "active",
      isDemo: true,
    })
    .returning();
  const [specialty] = await db
    .select({ name: specialtiesTable.name })
    .from(specialtiesTable)
    .where(eq(specialtiesTable.id, parsed.data.specialtyId))
    .limit(1);
  res.status(201).json(
    CreateTokenResponse.parse({
      id: token!.id,
      tokenNumber: token!.tokenNumber,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      specialtyId: parsed.data.specialtyId,
      specialty: specialty!.name,
      waitingMinutes: token!.waitingMinutes,
      status: "active",
      isDemo: true,
      createdAt: iso(token!.createdAt),
    }),
  );
});

router.get("/visit-plans", async (_req, res): Promise<void> => {
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const rows = await db
    .select({ plan: visitPlansTable, hospitalName: hospitalsTable.name })
    .from(visitPlansTable)
    .innerJoin(hospitalsTable, eq(visitPlansTable.hospitalId, hospitalsTable.id))
    .where(eq(visitPlansTable.userId, user.id))
    .orderBy(desc(visitPlansTable.visitDate), desc(visitPlansTable.createdAt));
  res.json(
    ListVisitPlansResponse.parse(
      rows.map(({ plan, hospitalName }) => ({
        id: plan.id,
        hospitalId: plan.hospitalId,
        hospitalName,
        visitDate: plan.visitDate,
        purpose: plan.purpose,
        notes: plan.notes,
        createdAt: iso(plan.createdAt),
      })),
    ),
  );
});

router.post("/visit-plans", async (req, res): Promise<void> => {
  const parsed = CreateVisitPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [hospital] = await db
    .select({ id: hospitalsTable.id, name: hospitalsTable.name })
    .from(hospitalsTable)
    .where(eq(hospitalsTable.id, parsed.data.hospitalId))
    .limit(1);
  if (!hospital) {
    res.status(404).json({ error: "Hospital not found." });
    return;
  }
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const [plan] = await db
    .insert(visitPlansTable)
    .values({
      userId: user.id,
      hospitalId: hospital.id,
      visitDate: parsed.data.visitDate.toISOString().slice(0, 10),
      purpose: parsed.data.purpose.trim(),
      notes: parsed.data.notes,
    })
    .returning();
  res.status(201).json(
    CreateVisitPlanResponse.parse({
      id: plan!.id,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      visitDate: plan!.visitDate,
      purpose: plan!.purpose,
      notes: plan!.notes,
      createdAt: iso(plan!.createdAt),
    }),
  );
});

router.patch("/visit-plans/:id", async (req, res): Promise<void> => {
  const params = UpdateVisitPlanParams.safeParse(req.params);
  const body = UpdateVisitPlanBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: params.success
        ? body.error?.message ?? "Invalid request."
        : params.error.message,
    });
    return;
  }
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const [hospital] = await db
    .select({ id: hospitalsTable.id, name: hospitalsTable.name })
    .from(hospitalsTable)
    .where(eq(hospitalsTable.id, body.data.hospitalId))
    .limit(1);
  if (!hospital) {
    res.status(404).json({ error: "Hospital not found." });
    return;
  }
  const [plan] = await db
    .update(visitPlansTable)
    .set({
      hospitalId: hospital.id,
      visitDate: body.data.visitDate.toISOString().slice(0, 10),
      purpose: body.data.purpose.trim(),
      notes: body.data.notes,
    })
    .where(
      and(
        eq(visitPlansTable.id, params.data.id),
        eq(visitPlansTable.userId, user.id),
      ),
    )
    .returning();
  if (!plan) {
    res.status(404).json({ error: "Visit plan not found." });
    return;
  }
  res.json(
    UpdateVisitPlanResponse.parse({
      id: plan.id,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      visitDate: plan.visitDate,
      purpose: plan.purpose,
      notes: plan.notes,
      createdAt: iso(plan.createdAt),
    }),
  );
});

router.delete("/visit-plans/:id", async (req, res): Promise<void> => {
  const parsed = DeleteVisitPlanParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = res.locals.carepathUser as typeof usersTable.$inferSelect;
  const [deleted] = await db
    .delete(visitPlansTable)
    .where(
      and(
        eq(visitPlansTable.id, parsed.data.id),
        eq(visitPlansTable.userId, user.id),
      ),
    )
    .returning({ id: visitPlansTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Visit plan not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;