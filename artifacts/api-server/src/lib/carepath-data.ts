import { and, eq } from "drizzle-orm";
import {
  db,
  doctorsTable,
  hospitalSpecialtiesTable,
  hospitalsTable,
  reviewsTable,
  specialtiesTable,
} from "@workspace/db";

export interface HospitalSearchLocation {
  latitude?: number;
  longitude?: number;
}

export interface HospitalSummary {
  id: number;
  name: string;
  type: "hospital" | "clinic";
  address: string;
  city: string;
  locality: string;
  contactPhone: string;
  distanceKm: number | null;
  specialties: string[];
  doctorCount: number;
  rating: number;
  reviewCount: number;
  waitingMinutes: number;
  isOpen: boolean;
  isDemo: boolean;
  emergency: boolean;
  hours: string;
}

function distanceInKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(toLatitude - fromLatitude);
  const dLon = radians(toLongitude - fromLongitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(fromLatitude)) *
      Math.cos(radians(toLatitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function listHospitalSummaries(
  location: HospitalSearchLocation = {},
): Promise<HospitalSummary[]> {
  const [hospitals, specialtyRows, doctorRows, reviewRows] = await Promise.all([
    db.select().from(hospitalsTable),
    db
      .select({
        hospitalId: hospitalSpecialtiesTable.hospitalId,
        name: specialtiesTable.name,
      })
      .from(hospitalSpecialtiesTable)
      .innerJoin(
        specialtiesTable,
        eq(hospitalSpecialtiesTable.specialtyId, specialtiesTable.id),
      ),
    db
      .select({ hospitalId: doctorsTable.hospitalId })
      .from(doctorsTable)
      .where(eq(doctorsTable.available, true)),
    db
      .select({
        hospitalId: reviewsTable.hospitalId,
        rating: reviewsTable.rating,
      })
      .from(reviewsTable)
      .where(eq(reviewsTable.status, "visible")),
  ]);

  const specialtiesByHospital = new Map<number, string[]>();
  for (const row of specialtyRows) {
    const values = specialtiesByHospital.get(row.hospitalId) ?? [];
    values.push(row.name);
    specialtiesByHospital.set(row.hospitalId, values);
  }

  const doctorCountByHospital = new Map<number, number>();
  for (const row of doctorRows) {
    doctorCountByHospital.set(
      row.hospitalId,
      (doctorCountByHospital.get(row.hospitalId) ?? 0) + 1,
    );
  }

  const reviewTotals = new Map<number, { sum: number; count: number }>();
  for (const row of reviewRows) {
    const current = reviewTotals.get(row.hospitalId) ?? { sum: 0, count: 0 };
    current.sum += row.rating;
    current.count += 1;
    reviewTotals.set(row.hospitalId, current);
  }

  const hasLocation =
    Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
  return hospitals.map((hospital) => {
    const reviews = reviewTotals.get(hospital.id) ?? { sum: 0, count: 0 };
    const locationDistance =
      hasLocation && hospital.latitude !== null && hospital.longitude !== null
        ? distanceInKm(
            location.latitude!,
            location.longitude!,
            hospital.latitude,
            hospital.longitude,
          )
        : null;
    return {
      id: hospital.id,
      name: hospital.name,
      type: hospital.type === "clinic" ? "clinic" : "hospital",
      address: hospital.address,
      city: hospital.city,
      locality: hospital.locality,
      contactPhone: hospital.contactPhone,
      distanceKm:
        locationDistance === null
          ? hospital.baseDistanceKm
          : Math.round(locationDistance * 10) / 10,
      specialties: specialtiesByHospital.get(hospital.id) ?? [],
      doctorCount: doctorCountByHospital.get(hospital.id) ?? 0,
      rating: reviews.count
        ? Math.round((reviews.sum / reviews.count) * 10) / 10
        : 0,
      reviewCount: reviews.count,
      waitingMinutes: hospital.waitingMinutes,
      isOpen: hospital.isOpen,
      isDemo: hospital.isDemo,
      emergency: hospital.emergency,
      hours: hospital.hours,
    };
  });
}

export async function hospitalExists(id: number): Promise<boolean> {
  const [hospital] = await db
    .select({ id: hospitalsTable.id })
    .from(hospitalsTable)
    .where(and(eq(hospitalsTable.id, id)))
    .limit(1);
  return Boolean(hospital);
}