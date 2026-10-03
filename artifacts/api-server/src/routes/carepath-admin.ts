import { and, asc, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AdminCreateDoctorBody,
  AdminCreateDoctorResponse,
  AdminCreateHospitalBody,
  AdminCreateHospitalResponse,
  AdminCreateSpecialtyBody,
  AdminCreateSpecialtyResponse,
  AdminDeleteDoctorParams,
  AdminDeleteHospitalParams,
  AdminDeleteSpecialtyParams,
  AdminListAppointmentsResponse,
  AdminListDoctorsResponse,
  AdminListHospitalsResponse,
  AdminListReviewsResponse,
  AdminListSpecialtiesResponse,
  AdminListUsersResponse,
  AdminModerateReviewBody,
  AdminModerateReviewParams,
  AdminModerateReviewResponse,
  AdminUpdateDoctorBody,
  AdminUpdateDoctorParams,
  AdminUpdateDoctorResponse,
  AdminUpdateHospitalBody,
  AdminUpdateHospitalParams,
  AdminUpdateHospitalResponse,
  AdminUpdateSpecialtyBody,
  AdminUpdateSpecialtyParams,
  AdminUpdateSpecialtyResponse,
} from "@workspace/api-zod";
import {
  appointmentsTable,
  db,
  doctorsTable,
  hospitalSpecialtiesTable,
  hospitalsTable,
  reviewsTable,
  specialtiesTable,
  usersTable,
} from "@workspace/db";
import { requireCarePathAdmin, requireCarePathUser } from "../lib/auth";
import { listHospitalSummaries } from "../lib/carepath-data";

const router: IRouter = Router();
router.use(requireCarePathUser, requireCarePathAdmin);
const iso = (value: Date) => value.toISOString();

function reviewOutput(
  review: typeof reviewsTable.$inferSelect,
  hospitalName: string,
) {
  return {
    id: review.id,
    hospitalId: review.hospitalId,
    hospitalName,
    userId: review.userId ?? "demo",
    userName: review.userName,
    rating: review.rating,
    text: review.text,
    status: review.status === "hidden" ? "hidden" : "visible",
    createdAt: iso(review.createdAt),
    isDemo: review.isDemo,
  };
}

async function setHospitalSpecialties(
  hospitalId: number,
  specialtyIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(hospitalSpecialtiesTable)
      .where(eq(hospitalSpecialtiesTable.hospitalId, hospitalId));
    if (specialtyIds.length) {
      await tx
        .insert(hospitalSpecialtiesTable)
        .values(
          [...new Set(specialtyIds)].map((specialtyId) => ({
            hospitalId,
            specialtyId,
          })),
        );
    }
  });
}

router.get("/hospitals", async (_req, res): Promise<void> => {
  const hospitals = await listHospitalSummaries();
  res.json(AdminListHospitalsResponse.parse(hospitals));
});

router.post("/hospitals", async (req, res): Promise<void> => {
  const parsed = AdminCreateHospitalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { specialtyIds, ...fields } = parsed.data;
  const [hospital] = await db
    .insert(hospitalsTable)
    .values({
      ...fields,
      isDemo: true,
      baseDistanceKm: 5,
      latitude: null,
      longitude: null,
    })
    .returning();
  await setHospitalSpecialties(hospital!.id, specialtyIds);
  const result = (await listHospitalSummaries()).find(
    (item) => item.id === hospital!.id,
  );
  res.status(201).json(AdminCreateHospitalResponse.parse(result));
});

router.patch("/hospitals/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateHospitalParams.safeParse(req.params);
  const parsed = AdminUpdateHospitalBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: params.success
        ? parsed.error?.message ?? "Invalid request."
        : params.error.message,
    });
    return;
  }
  const { specialtyIds, ...fields } = parsed.data;
  const [hospital] = await db
    .update(hospitalsTable)
    .set(fields)
    .where(eq(hospitalsTable.id, params.data.id))
    .returning({ id: hospitalsTable.id });
  if (!hospital) {
    res.status(404).json({ error: "Hospital not found." });
    return;
  }
  if (specialtyIds !== undefined) {
    await setHospitalSpecialties(hospital.id, specialtyIds);
  }
  const result = (await listHospitalSummaries()).find(
    (item) => item.id === hospital.id,
  );
  res.json(AdminUpdateHospitalResponse.parse(result));
});

router.delete("/hospitals/:id", async (req, res): Promise<void> => {
  const parsed = AdminDeleteHospitalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [deleted] = await db
    .delete(hospitalsTable)
    .where(eq(hospitalsTable.id, parsed.data.id))
    .returning({ id: hospitalsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Hospital not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/doctors", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ doctor: doctorsTable, specialty: specialtiesTable.name })
    .from(doctorsTable)
    .innerJoin(specialtiesTable, eq(doctorsTable.specialtyId, specialtiesTable.id))
    .orderBy(asc(doctorsTable.name));
  res.json(
    AdminListDoctorsResponse.parse(
      rows.map(({ doctor, specialty }) => ({
        id: doctor.id,
        hospitalId: doctor.hospitalId,
        name: doctor.name,
        specialtyId: doctor.specialtyId,
        specialty,
        qualifications: doctor.qualifications,
        yearsExperience: doctor.yearsExperience,
        available: doctor.available,
      })),
    ),
  );
});

router.post("/doctors", async (req, res): Promise<void> => {
  const parsed = AdminCreateDoctorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [doctor] = await db
    .insert(doctorsTable)
    .values(parsed.data)
    .returning();
  const [specialty] = await db
    .select({ name: specialtiesTable.name })
    .from(specialtiesTable)
    .where(eq(specialtiesTable.id, doctor!.specialtyId))
    .limit(1);
  res.status(201).json(
    AdminCreateDoctorResponse.parse({
      id: doctor!.id,
      hospitalId: doctor!.hospitalId,
      name: doctor!.name,
      specialtyId: doctor!.specialtyId,
      specialty: specialty!.name,
      qualifications: doctor!.qualifications,
      yearsExperience: doctor!.yearsExperience,
      available: doctor!.available,
    }),
  );
});

router.patch("/doctors/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateDoctorParams.safeParse(req.params);
  const parsed = AdminUpdateDoctorBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: params.success
        ? parsed.error?.message ?? "Invalid request."
        : params.error.message,
    });
    return;
  }
  const [doctor] = await db
    .update(doctorsTable)
    .set(parsed.data)
    .where(eq(doctorsTable.id, params.data.id))
    .returning();
  if (!doctor) {
    res.status(404).json({ error: "Doctor not found." });
    return;
  }
  const [specialty] = await db
    .select({ name: specialtiesTable.name })
    .from(specialtiesTable)
    .where(eq(specialtiesTable.id, doctor.specialtyId))
    .limit(1);
  res.json(
    AdminUpdateDoctorResponse.parse({
      id: doctor.id,
      hospitalId: doctor.hospitalId,
      name: doctor.name,
      specialtyId: doctor.specialtyId,
      specialty: specialty!.name,
      qualifications: doctor.qualifications,
      yearsExperience: doctor.yearsExperience,
      available: doctor.available,
    }),
  );
});

router.delete("/doctors/:id", async (req, res): Promise<void> => {
  const parsed = AdminDeleteDoctorParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [deleted] = await db
    .delete(doctorsTable)
    .where(eq(doctorsTable.id, parsed.data.id))
    .returning({ id: doctorsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Doctor not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/specialties", async (_req, res): Promise<void> => {
  const rows = await db.select().from(specialtiesTable).orderBy(asc(specialtiesTable.name));
  res.json(AdminListSpecialtiesResponse.parse(rows));
});

router.post("/specialties", async (req, res): Promise<void> => {
  const parsed = AdminCreateSpecialtyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [specialty] = await db
    .insert(specialtiesTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(AdminCreateSpecialtyResponse.parse(specialty));
});

router.patch("/specialties/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateSpecialtyParams.safeParse(req.params);
  const parsed = AdminUpdateSpecialtyBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: params.success
        ? parsed.error?.message ?? "Invalid request."
        : params.error.message,
    });
    return;
  }
  const [specialty] = await db
    .update(specialtiesTable)
    .set(parsed.data)
    .where(eq(specialtiesTable.id, params.data.id))
    .returning();
  if (!specialty) {
    res.status(404).json({ error: "Specialty not found." });
    return;
  }
  res.json(AdminUpdateSpecialtyResponse.parse(specialty));
});

router.delete("/specialties/:id", async (req, res): Promise<void> => {
  const parsed = AdminDeleteSpecialtyParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [deleted] = await db
      .delete(specialtiesTable)
      .where(eq(specialtiesTable.id, parsed.data.id))
      .returning({ id: specialtiesTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Specialty not found." });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    req.log.warn({ err: error, specialtyId: parsed.data.id }, "Specialty is still in use");
    res.status(409).json({ error: "Remove this specialty from doctors and visits before deleting it." });
  }
});

router.get("/appointments", async (_req, res): Promise<void> => {
  const rows = await db
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
    .orderBy(desc(appointmentsTable.appointmentDate), desc(appointmentsTable.createdAt));
  res.json(
    AdminListAppointmentsResponse.parse(
      rows.map(({ appointment, hospitalName, specialty, doctorName }) => ({
        id: appointment.id,
        appointmentCode: appointment.appointmentCode,
        patientName: appointment.patientName,
        hospitalId: appointment.hospitalId,
        hospitalName,
        specialtyId: appointment.specialtyId,
        specialty,
        doctorId: appointment.doctorId,
        doctorName,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status === "cancelled" ? "cancelled" : "booked",
        isDemo: appointment.isDemo,
        createdAt: iso(appointment.createdAt),
      })),
    ),
  );
});

router.get("/users", async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(asc(usersTable.createdAt));
  res.json(
    AdminListUsersResponse.parse(
      rows.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role === "admin" ? "admin" : "user",
        createdAt: iso(user.createdAt),
      })),
    ),
  );
});

router.get("/reviews", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ review: reviewsTable, hospitalName: hospitalsTable.name })
    .from(reviewsTable)
    .innerJoin(hospitalsTable, eq(reviewsTable.hospitalId, hospitalsTable.id))
    .orderBy(desc(reviewsTable.createdAt));
  res.json(
    AdminListReviewsResponse.parse(
      rows.map(({ review, hospitalName }) => reviewOutput(review, hospitalName)),
    ),
  );
});

router.patch("/reviews/:id", async (req, res): Promise<void> => {
  const params = AdminModerateReviewParams.safeParse(req.params);
  const parsed = AdminModerateReviewBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({
      error: params.success
        ? parsed.error?.message ?? "Invalid request."
        : params.error.message,
    });
    return;
  }
  const [review] = await db
    .update(reviewsTable)
    .set({ status: parsed.data.status })
    .where(eq(reviewsTable.id, params.data.id))
    .returning();
  if (!review) {
    res.status(404).json({ error: "Review not found." });
    return;
  }
  const [hospital] = await db
    .select({ name: hospitalsTable.name })
    .from(hospitalsTable)
    .where(eq(hospitalsTable.id, review.hospitalId))
    .limit(1);
  res.json(
    AdminModerateReviewResponse.parse(reviewOutput(review, hospital!.name)),
  );
});

export default router;