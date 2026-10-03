import { eq } from "drizzle-orm";
import {
  db,
  doctorsTable,
  emergencyFacilitiesTable,
  hospitalSpecialtiesTable,
  hospitalsTable,
  reviewsTable,
  specialtiesTable,
} from "@workspace/db";
import { logger } from "./logger";

const specialtySeeds = [
  ["General Medicine", "Primary care and common health concerns."],
  ["Cardiology", "Heart health and cardiovascular care."],
  ["Pediatrics", "Healthcare for infants, children, and adolescents."],
  ["Dermatology", "Skin, hair, and nail health."],
  ["Orthopedics", "Bone, joint, and musculoskeletal care."],
  ["Gynecology", "Women's reproductive and preventive healthcare."],
];

const hospitalSeeds = [
  {
    name: "Olive Grove Medical Centre",
    type: "hospital",
    city: "Hyderabad",
    locality: "Banjara Hills",
    address: "Road No. 12, Banjara Hills, Hyderabad",
    contactPhone: "+91 40 4000 0101",
    latitude: 17.4142,
    longitude: 78.4482,
    baseDistanceKm: 2.4,
    waitingMinutes: 18,
    isOpen: true,
    emergency: true,
    hours: "Open 24 hours",
    specialties: ["General Medicine", "Cardiology", "Pediatrics", "Orthopedics"],
  },
  {
    name: "Deccan Family Health Clinic",
    type: "clinic",
    city: "Hyderabad",
    locality: "Madhapur",
    address: "100 Feet Road, Madhapur, Hyderabad",
    contactPhone: "+91 40 4000 0102",
    latitude: 17.4485,
    longitude: 78.3908,
    baseDistanceKm: 4.8,
    waitingMinutes: 12,
    isOpen: true,
    emergency: false,
    hours: "9:00 AM–8:00 PM",
    specialties: ["General Medicine", "Dermatology", "Pediatrics"],
  },
  {
    name: "Lakeview Heart & Care Hospital",
    type: "hospital",
    city: "Hyderabad",
    locality: "Somajiguda",
    address: "Raj Bhavan Road, Somajiguda, Hyderabad",
    contactPhone: "+91 40 4000 0103",
    latitude: 17.4239,
    longitude: 78.4621,
    baseDistanceKm: 3.1,
    waitingMinutes: 26,
    isOpen: true,
    emergency: true,
    hours: "Open 24 hours",
    specialties: ["General Medicine", "Cardiology", "Gynecology"],
  },
  {
    name: "Vijaya Family & Specialty Clinic",
    type: "clinic",
    city: "Vijayawada",
    locality: "Benz Circle",
    address: "MG Road, Benz Circle, Vijayawada",
    contactPhone: "+91 866 400 0201",
    latitude: 16.4971,
    longitude: 80.6515,
    baseDistanceKm: 1.8,
    waitingMinutes: 15,
    isOpen: true,
    emergency: false,
    hours: "8:30 AM–9:00 PM",
    specialties: ["General Medicine", "Pediatrics", "Dermatology", "Gynecology"],
  },
  {
    name: "Krishna Riverfront Medical Hospital",
    type: "hospital",
    city: "Vijayawada",
    locality: "Governor Peta",
    address: "Eluru Road, Governor Peta, Vijayawada",
    contactPhone: "+91 866 400 0202",
    latitude: 16.5193,
    longitude: 80.6305,
    baseDistanceKm: 4.2,
    waitingMinutes: 32,
    isOpen: true,
    emergency: true,
    hours: "Open 24 hours",
    specialties: ["General Medicine", "Cardiology", "Orthopedics", "Pediatrics"],
  },
  {
    name: "Amaravati Bone & Women's Care",
    type: "clinic",
    city: "Vijayawada",
    locality: "Labbipet",
    address: "Mogalrajpuram Road, Labbipet, Vijayawada",
    contactPhone: "+91 866 400 0203",
    latitude: 16.5057,
    longitude: 80.6414,
    baseDistanceKm: 3.3,
    waitingMinutes: 20,
    isOpen: false,
    emergency: false,
    hours: "9:00 AM–6:00 PM",
    specialties: ["Orthopedics", "Gynecology", "General Medicine"],
  },
];

export async function seedCarePathDemoData(): Promise<void> {
  const [existing] = await db
    .select({ id: hospitalsTable.id })
    .from(hospitalsTable)
    .limit(1);
  if (existing) return;

  await db
    .insert(specialtiesTable)
    .values(
      specialtySeeds.map(([name, description]) => ({
        name: name!,
        description: description!,
      })),
    )
    .onConflictDoNothing();

  const specialties = await db.select().from(specialtiesTable);
  const specialtyId = new Map(specialties.map((item) => [item.name, item.id]));
  const insertedHospitals = await db
    .insert(hospitalsTable)
    .values(
      hospitalSeeds.map((hospital) => ({
        name: hospital.name,
        type: hospital.type,
        city: hospital.city,
        locality: hospital.locality,
        address: hospital.address,
        contactPhone: hospital.contactPhone,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        baseDistanceKm: hospital.baseDistanceKm,
        waitingMinutes: hospital.waitingMinutes,
        isOpen: hospital.isOpen,
        emergency: hospital.emergency,
        hours: hospital.hours,
        isDemo: true,
      })),
    )
    .onConflictDoNothing()
    .returning();

  const allHospitals = insertedHospitals.length
    ? insertedHospitals
    : await db.select().from(hospitalsTable);
  const allSpecialtyLinks = allHospitals.flatMap((hospital) => {
    const seed = hospitalSeeds.find(
      (candidate) =>
        candidate.name === hospital.name && candidate.city === hospital.city,
    );
    return (seed?.specialties ?? [])
      .map((name) => specialtyId.get(name))
      .filter((id): id is number => id !== undefined)
      .map((id) => ({ hospitalId: hospital.id, specialtyId: id }));
  });
  if (allSpecialtyLinks.length) {
    await db
      .insert(hospitalSpecialtiesTable)
      .values(allSpecialtyLinks)
      .onConflictDoNothing();
  }

  const doctors = [
    ["Dr. Asha Reddy", "Olive Grove Medical Centre", "General Medicine", "MBBS, MD", 12],
    ["Dr. Vikram Rao", "Olive Grove Medical Centre", "Cardiology", "MBBS, DM", 16],
    ["Dr. Kavya Menon", "Olive Grove Medical Centre", "Pediatrics", "MBBS, DCH", 9],
    ["Dr. Nikhil Varma", "Deccan Family Health Clinic", "Dermatology", "MBBS, MD", 11],
    ["Dr. Meera Iyer", "Lakeview Heart & Care Hospital", "Gynecology", "MBBS, MS", 14],
    ["Dr. Sandeep Kumar", "Vijaya Family & Specialty Clinic", "General Medicine", "MBBS, MD", 10],
    ["Dr. P. Lakshmi", "Vijaya Family & Specialty Clinic", "Pediatrics", "MBBS, DCH", 8],
    ["Dr. Arjun Prasad", "Krishna Riverfront Medical Hospital", "Orthopedics", "MBBS, MS", 13],
    ["Dr. S. Nirmala", "Krishna Riverfront Medical Hospital", "Cardiology", "MBBS, DM", 15],
    ["Dr. Ritu Sharma", "Amaravati Bone & Women's Care", "Gynecology", "MBBS, MS", 12],
  ] as const;
  const hospitalId = new Map(allHospitals.map((item) => [item.name, item.id]));
  const seededDoctorRows = doctors.flatMap(
    ([name, hospital, specialty, qualifications, yearsExperience]) => {
      const hId = hospitalId.get(hospital);
      const sId = specialtyId.get(specialty);
      return hId && sId
        ? [{ name, hospitalId: hId, specialtyId: sId, qualifications, yearsExperience, available: true }]
        : [];
    },
  );
  if (seededDoctorRows.length) {
    await db.insert(doctorsTable).values(seededDoctorRows);
  }

  const hospitalByName = new Map(allHospitals.map((item) => [item.name, item.id]));
  const sampleReviews = [
    [hospitalByName.get("Olive Grove Medical Centre"), "A. Patient", 5, "Friendly staff and an easy-to-follow visit process."],
    [hospitalByName.get("Deccan Family Health Clinic"), "R. Kumar", 4, "Convenient location and a short wait during my visit."],
    [hospitalByName.get("Vijaya Family & Specialty Clinic"), "S. Rao", 5, "The clinic information was clear and the team was welcoming."],
  ] as const;
  const reviewRows = sampleReviews.flatMap(([hospitalIdValue, userName, rating, text]) =>
    hospitalIdValue
      ? [{ hospitalId: hospitalIdValue, userId: null, userName, rating, text, status: "visible", isDemo: true }]
      : [],
  );
  if (reviewRows.length) await db.insert(reviewsTable).values(reviewRows);

  await db.insert(emergencyFacilitiesTable).values([
    {
      name: "Olive Grove Medical Centre — Emergency",
      type: "Hospital emergency department",
      address: "Road No. 12, Banjara Hills",
      city: "Hyderabad",
      phone: "108",
      category: "Emergency department",
      availabilityNote: "Sample listing only — call 108 to confirm emergency help.",
    },
    {
      name: "Lakeview Heart & Care Hospital — Emergency",
      type: "Hospital emergency department",
      address: "Raj Bhavan Road, Somajiguda",
      city: "Hyderabad",
      phone: "108",
      category: "Cardiac care",
      availabilityNote: "Sample listing only — availability is not live.",
    },
    {
      name: "Krishna Riverfront Medical Hospital — Emergency",
      type: "Hospital emergency department",
      address: "Eluru Road, Governor Peta",
      city: "Vijayawada",
      phone: "108",
      category: "Emergency department",
      availabilityNote: "Sample listing only — call 108 to confirm emergency help.",
    },
    {
      name: "Vijaya Family & Specialty Clinic",
      type: "Clinic",
      address: "MG Road, Benz Circle",
      city: "Vijayawada",
      phone: "108",
      category: "General care",
      availabilityNote: "Sample listing only — availability is not live.",
    },
  ]);

  const [seededCount] = await db
    .select({ id: hospitalsTable.id })
    .from(hospitalsTable)
    .where(eq(hospitalsTable.isDemo, true))
    .limit(1);
  logger.info({ seeded: Boolean(seededCount) }, "CarePath demo listings are ready");
}