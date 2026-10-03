import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("carepath_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const specialtiesTable = pgTable("carepath_specialties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
});

export const hospitalsTable = pgTable(
  "carepath_hospitals",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull().default("hospital"),
    address: text("address").notNull(),
    city: text("city").notNull(),
    locality: text("locality").notNull(),
    contactPhone: text("contact_phone").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    baseDistanceKm: doublePrecision("base_distance_km").notNull().default(5),
    waitingMinutes: integer("waiting_minutes").notNull().default(20),
    isOpen: boolean("is_open").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(true),
    emergency: boolean("emergency").notNull().default(false),
    hours: text("hours").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("carepath_hospital_name_city_unique").on(table.name, table.city)],
);

export const hospitalSpecialtiesTable = pgTable(
  "carepath_hospital_specialties",
  {
    hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id, { onDelete: "cascade" }),
    specialtyId: integer("specialty_id").notNull().references(() => specialtiesTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.hospitalId, table.specialtyId] })],
);

export const doctorsTable = pgTable(
  "carepath_doctors",
  {
    id: serial("id").primaryKey(),
    hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id, { onDelete: "cascade" }),
    specialtyId: integer("specialty_id").notNull().references(() => specialtiesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    qualifications: text("qualifications").notNull().default("MBBS"),
    yearsExperience: integer("years_experience").notNull().default(0),
    available: boolean("available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("carepath_doctor_hospital_idx").on(table.hospitalId)],
);

export const appointmentsTable = pgTable(
  "carepath_appointments",
  {
    id: serial("id").primaryKey(),
    appointmentCode: text("appointment_code").notNull().unique(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    patientName: text("patient_name").notNull(),
    hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id, { onDelete: "cascade" }),
    specialtyId: integer("specialty_id").notNull().references(() => specialtiesTable.id, { onDelete: "restrict" }),
    doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "restrict" }),
    appointmentDate: date("appointment_date", { mode: "string" }).notNull(),
    appointmentTime: text("appointment_time").notNull(),
    status: text("status").notNull().default("booked"),
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("carepath_appointment_user_idx").on(table.userId, table.appointmentDate)],
);

export const tokensTable = pgTable(
  "carepath_tokens",
  {
    id: serial("id").primaryKey(),
    tokenNumber: text("token_number").notNull().unique(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id, { onDelete: "cascade" }),
    specialtyId: integer("specialty_id").notNull().references(() => specialtiesTable.id, { onDelete: "restrict" }),
    waitingMinutes: integer("waiting_minutes").notNull(),
    status: text("status").notNull().default("active"),
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("carepath_token_user_idx").on(table.userId, table.createdAt)],
);

export const visitPlansTable = pgTable(
  "carepath_visit_plans",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id, { onDelete: "cascade" }),
    visitDate: date("visit_date", { mode: "string" }).notNull(),
    purpose: text("purpose").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("carepath_plan_user_idx").on(table.userId, table.visitDate)],
);

export const reviewsTable = pgTable(
  "carepath_reviews",
  {
    id: serial("id").primaryKey(),
    hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    userName: text("user_name").notNull(),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    status: text("status").notNull().default("visible"),
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("carepath_review_hospital_idx").on(table.hospitalId, table.status)],
);

export const emergencyFacilitiesTable = pgTable("carepath_emergency_facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  phone: text("phone").notNull().default("108"),
  category: text("category").notNull(),
  availabilityNote: text("availability_note").notNull(),
  isDemo: boolean("is_demo").notNull().default(true),
});

export const insertHospitalSchema = createInsertSchema(hospitalsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHospital = z.infer<typeof insertHospitalSchema>;
export type Hospital = typeof hospitalsTable.$inferSelect;
export type Specialty = typeof specialtiesTable.$inferSelect;
export type Doctor = typeof doctorsTable.$inferSelect;
export type Appointment = typeof appointmentsTable.$inferSelect;
export type DemoToken = typeof tokensTable.$inferSelect;
export type VisitPlan = typeof visitPlansTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type EmergencyFacility = typeof emergencyFacilitiesTable.$inferSelect;