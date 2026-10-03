import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetDashboardResponse,
  GetHospitalParams,
  GetHospitalResponse,
  CreateReviewBody,
  ListEmergencyFacilitiesQueryParams,
  ListEmergencyFacilitiesResponse,
  ListHospitalsQueryParams,
  ListHospitalsResponse,
  ListSpecialtiesResponse,
} from "@workspace/api-zod";
import {
  db,
  doctorsTable,
  emergencyFacilitiesTable,
  hospitalSpecialtiesTable,
  hospitalsTable,
  reviewsTable,
  specialtiesTable,
} from "@workspace/db";
import { listHospitalSummaries } from "../lib/carepath-data";
import { requireCarePathUser } from "../lib/auth";
import type { Request, Response } from "express";

const router: IRouter = Router();

function dateTime(value: Date): string {
  return value.toISOString();
}

function reviewResponse(
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
    createdAt: dateTime(review.createdAt),
    isDemo: review.isDemo,
  };
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [hospitals, specialties] = await Promise.all([
    listHospitalSummaries(),
    db.select().from(specialtiesTable).orderBy(asc(specialtiesTable.name)),
  ]);
  const cities = [...new Set(hospitals.map((hospital) => hospital.city))].sort();
  res.json(
    GetDashboardResponse.parse({
      hospitalCount: hospitals.length,
      specialtyCount: specialties.length,
      cityCount: cities.length,
      cities,
      featuredHospitals: hospitals.slice(0, 4),
      specialties,
    }),
  );
});

router.get("/hospitals", async (req, res): Promise<void> => {
  const rawOpen = req.query["open"];
  const queryInput = {
    ...req.query,
    open:
      rawOpen === "true" ? true : rawOpen === "false" ? false : undefined,
  };
  const parsed = ListHospitalsQueryParams.safeParse(queryInput);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const query = parsed.data;
  const hospitalRows = await db.select().from(hospitalsTable);
  let results = await listHospitalSummaries({
    latitude: query.latitude,
    longitude: query.longitude,
  });
  const rowById = new Map(hospitalRows.map((hospital) => [hospital.id, hospital]));
  const q = query.q?.trim().toLowerCase();
  const city = query.city?.trim().toLowerCase();
  const locality = query.locality?.trim().toLowerCase();
  const specialty = query.specialty?.trim().toLowerCase();

  results = results.filter((hospital) => {
    const row = rowById.get(hospital.id);
    const matchesQ =
      !q ||
      [
        hospital.name,
        hospital.city,
        hospital.locality,
        hospital.address,
        ...hospital.specialties,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    const matchesCity = !city || hospital.city.toLowerCase().includes(city);
    const matchesLocality =
      !locality || hospital.locality.toLowerCase().includes(locality);
    const matchesType = !query.type || hospital.type === query.type;
    const matchesOpen = query.open === undefined || hospital.isOpen === query.open;
    const matchesSpecialty =
      !specialty ||
      hospital.specialties.some((item) => item.toLowerCase() === specialty);
    return Boolean(
      row &&
        matchesQ &&
        matchesCity &&
        matchesLocality &&
        matchesType &&
        matchesOpen &&
        matchesSpecialty,
    );
  });

  if (query.latitude !== undefined && query.longitude !== undefined) {
    results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  res.json(ListHospitalsResponse.parse(results));
});

router.get("/hospitals/:id", async (req, res): Promise<void> => {
  const parsed = GetHospitalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [hospital] = await db
    .select()
    .from(hospitalsTable)
    .where(eq(hospitalsTable.id, parsed.data.id))
    .limit(1);
  if (!hospital) {
    res.status(404).json({ error: "Hospital not found." });
    return;
  }

  const summaries = await listHospitalSummaries();
  const summary = summaries.find((item) => item.id === hospital.id);
  if (!summary) {
    res.status(404).json({ error: "Hospital not found." });
    return;
  }
  const [doctorRows, reviewRows] = await Promise.all([
    db
      .select({
        doctor: doctorsTable,
        specialty: specialtiesTable.name,
      })
      .from(doctorsTable)
      .innerJoin(
        specialtiesTable,
        eq(doctorsTable.specialtyId, specialtiesTable.id),
      )
      .where(eq(doctorsTable.hospitalId, hospital.id))
      .orderBy(asc(doctorsTable.name)),
    db
      .select()
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.hospitalId, hospital.id),
          eq(reviewsTable.status, "visible"),
        ),
      )
      .orderBy(desc(reviewsTable.createdAt)),
  ]);
  const detail = {
    ...summary,
    doctors: doctorRows.map(({ doctor, specialty }) => ({
      id: doctor.id,
      hospitalId: doctor.hospitalId,
      name: doctor.name,
      specialtyId: doctor.specialtyId,
      specialty,
      qualifications: doctor.qualifications,
      yearsExperience: doctor.yearsExperience,
      available: doctor.available,
    })),
    reviews: reviewRows.map((review) => reviewResponse(review, hospital.name)),
  };
  res.json(GetHospitalResponse.parse(detail));
});

router.get("/specialties", async (_req, res): Promise<void> => {
  const specialties = await db
    .select()
    .from(specialtiesTable)
    .orderBy(asc(specialtiesTable.name));
  res.json(ListSpecialtiesResponse.parse(specialties));
});

router.get("/emergency-facilities", async (req, res): Promise<void> => {
  const parsed = ListEmergencyFacilitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.city) {
    filters.push(ilike(emergencyFacilitiesTable.city, `%${parsed.data.city}%`));
  }
  if (parsed.data.category) {
    filters.push(
      ilike(emergencyFacilitiesTable.category, `%${parsed.data.category}%`),
    );
  }
  const facilities = await db
    .select()
    .from(emergencyFacilitiesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(emergencyFacilitiesTable.city), asc(emergencyFacilitiesTable.name));
  res.json(ListEmergencyFacilitiesResponse.parse(facilities));
});

router.post(
  "/hospitals/:id/reviews",
  requireCarePathUser,
  async (req: Request, res: Response): Promise<void> => {
    const params = GetHospitalParams.safeParse(req.params);
    const body = CreateReviewBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: params.success
          ? body.error?.message ?? "Invalid request."
          : params.error.message,
      });
      return;
    }
    const [hospital] = await db
      .select()
      .from(hospitalsTable)
      .where(eq(hospitalsTable.id, params.data.id))
      .limit(1);
    if (!hospital) {
      res.status(404).json({ error: "Hospital not found." });
      return;
    }
    const user = res.locals.carepathUser as { id: string; name: string };
    const [review] = await db
      .insert(reviewsTable)
      .values({
        hospitalId: hospital.id,
        userId: user.id,
        userName: user.name,
        rating: body.data.rating,
        text: body.data.text.trim(),
        status: "visible",
        isDemo: true,
      })
      .returning();
    res.status(201).json(
      reviewResponse(review!, hospital.name),
    );
  },
);

export default router;