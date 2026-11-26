"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { hashPassword, newId } from "./crypto";
import { db, mutate } from "./db";
import { personalCoupon } from "./retention-core";
import { fail, run, str } from "./server-utils";
import type { CityRule, DeliverySettings, MembershipPlan } from "./types";

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, min: number, max: number, label: string, places = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max}`);
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
const note = (userId: string, title: string, body: string, href: string) => ({ id: newId(), userId, title, body, href, createdAt: Date.now(), readBy: [] as string[] });

/* ---------------- Membership ---------------- */
export async function saveMembership(enabled: boolean, plans: MembershipPlan[]) {
  return run(async () => {
    await requireUser("admin");
    if (!Array.isArray(plans) || plans.length > 6) fail("Add up to 6 plans");
    const clean = plans.map((p) => {
      const name = str(p.name, 40);
      if (name.length < 2) fail("Every plan needs a name");
      const id = str(p.id, 30).toLowerCase() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (!/^[a-z0-9-]{2,30}$/.test(id)) fail(`Plan "${name}" needs a valid id`);
      if (!HEX.test(p.color)) fail(`Plan "${name}" needs a valid colour`);
      return {
        id, name, color: p.color, active: !!p.active, freeDelivery: !!p.freeDelivery, tagline: str(p.tagline, 80),
        price: num(p.price, 1, 100000, `${name} price`), days: num(p.days, 1, 1095, `${name} duration (days)`),
        discountPct: num(p.discountPct, 0, 50, `${name} discount %`), coinMultiplier: num(p.coinMultiplier, 1, 5, `${name} coin multiplier`, 2),
      };
    });
    if (new Set(clean.map((p) => p.id)).size !== clean.length) fail("Plan ids must be unique");
    await mutate((d) => {
      const removed = (d.retention.membership?.plans ?? []).filter((p) => !clean.some((c) => c.id === p.id));
      const sold = removed.find((p) => (d.memberships ?? []).some((m) => m.planId === p.id) || d.users.some((u) => u.membership?.planId === p.id));
      if (sold) fail(`"${sold.name}" has members — deactivate it instead of deleting`);
      d.retention.membership = { enabled: !!enabled, plans: clean };
    });
    revalidatePath("/admin/membership"); revalidatePath("/", "layout");
  });
}

export async function extendMembership(userId: string, days: number) {
  return run(async () => {
    await requireUser("admin");
    const n = num(days, 1, 365, "Days");
    await mutate((d) => {
      const u = d.users.find((x) => x.id === str(userId, 40));
      if (!u?.membership) fail("This customer has no membership");
      u!.membership!.expiresAt = Math.max(u!.membership!.expiresAt, Date.now()) + n * 86_400_000;
      d.notifications.push(note(u!.id, "Membership extended 👑", `We've added ${n} days. Your perks now run until ${new Date(u!.membership!.expiresAt).toLocaleDateString("en-IN")}.`, "/membership"));
    });
    revalidatePath("/admin/membership");
  });
}

export async function cancelMembership(userId: string) {
  return run(async () => {
    await requireUser("admin");
    await mutate((d) => {
      const u = d.users.find((x) => x.id === str(userId, 40));
      if (!u?.membership || u.membership.expiresAt <= Date.now()) fail("No active membership to cancel");
      u!.membership!.expiresAt = Date.now();
      d.notifications.push(note(u!.id, "Membership ended", "Your membership has been cancelled. Contact support if this was unexpected.", "/membership"));
    });
    revalidatePath("/admin/membership");
  });
}

/* ---------------- City delivery ---------------- */
export async function saveDeliverySettings(s: DeliverySettings) {
  return run(async () => {
    await requireUser("admin");
    if (!Array.isArray(s?.cities) || s.cities.length > 200) fail("Too many cities");
    const days = (v: unknown, label: string): [number, number] => {
      const [a, b] = Array.isArray(v) ? v : [];
      const lo = num(a, 0, 30, `${label} min days`), hi = num(b, 0, 30, `${label} max days`);
      if (lo > hi) fail(`${label}: min days can't be more than max days`);
      return [lo, hi];
    };
    const cities: CityRule[] = s.cities.map((c) => {
      const name = str(c.name, 40);
      if (name.length < 2) fail("City names need 2–40 characters");
      return {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, active: !!c.active, express: !!c.express, cod: !!c.cod,
        standardFee: num(c.standardFee, 0, 2000, `${name} standard fee`), expressFee: num(c.expressFee, 0, 2000, `${name} express fee`),
        standardDays: days(c.standardDays, `${name} standard`), expressDays: days(c.expressDays, `${name} express`),
      };
    });
    if (new Set(cities.map((c) => c.name.toLowerCase())).size !== cities.length) fail("Each city can only be listed once");
    const clean: DeliverySettings = {
      restrictToCities: !!s.restrictToCities, cities,
      standardFee: num(s.standardFee, 0, 2000, "Default standard fee"), expressFee: num(s.expressFee, 0, 2000, "Default express fee"),
      freeAbove: num(s.freeAbove, 0, 1000000, "Free-delivery threshold"),
    };
    if (clean.restrictToCities && !cities.some((c) => c.active)) fail("Add at least one active city before restricting delivery to listed cities");
    await mutate((d) => { d.delivery = clean; });
    revalidatePath("/admin/delivery"); revalidatePath("/", "layout");
  });
}

export async function setRiderCity(userId: string, city: string | null) {
  return run(async () => {
    await requireUser("admin");
    const c = str(city, 40);
    await mutate((d) => {
      const u = d.users.find((x) => x.id === str(userId, 40) && x.role === "delivery");
      if (!u) fail("Delivery partner not found");
      u!.city = c || undefined;
    });
    revalidatePath("/admin/delivery"); revalidatePath("/admin/orders");
  });
}

export async function createDeliveryPartner(input: { name: string; email: string; phone: string; password: string; city?: string }) {
  return run(async () => {
    await requireUser("admin");
    const name = str(input.name, 80);
    const email = str(input.email, 120).toLowerCase();
    const phone = str(input.phone, 15).replace(/\D/g, "").slice(-10);
    const password = String(input.password ?? "");
    const city = str(input.city, 40);
    if (name.length < 2) fail("Enter partner's full name");
    if (!/^[6-9]\d{9}$/.test(phone)) fail("Enter a valid 10-digit mobile number");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address");
    if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) fail("Password needs 8+ characters with letters and numbers");
    if (db().users.some((u) => u.email === email)) fail("An account with this email already exists");
    if (db().users.some((u) => u.phone === phone)) fail("An account with this mobile number already exists");
    await mutate((d) => {
      d.users.push({
        id: newId(),
        name,
        email,
        phone,
        passwordHash: hashPassword(password),
        role: "delivery",
        blocked: false,
        city: city || undefined,
        addresses: [],
        measurements: {},
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    });
    revalidatePath("/admin/delivery"); revalidatePath("/admin/customers"); revalidatePath("/admin/orders");
  });
}

/* ---------------- Customer tracking ---------------- */
export async function sendPersonalCoupon(userId: string, o: { type: "percent" | "flat"; value: number; days: number; minOrder?: number; message?: string }) {
  return run(async () => {
    await requireUser("admin");
    const percent = o?.type !== "flat";
    const value = num(o?.value, 1, percent ? 90 : 100000, percent ? "Discount %" : "Discount ₹");
    const days = num(o?.days, 1, 90, "Valid days");
    const minOrder = num(o?.minOrder || 0, 0, 1000000, "Minimum order");
    const msg = str(o?.message, 200);
    const code = await mutate((d) => {
      const u = d.users.find((x) => x.id === str(userId, 40) && x.role === "customer");
      if (!u) fail("Customer not found");
      const off = percent ? `${value}% off` : `₹${value} off`;
      const c = personalCoupon(d, [u!.id], { type: percent ? "percent" : "flat", value, days, minOrder, maxDiscount: percent ? 2000 : undefined, description: `Just for you: ${off}${minOrder ? ` over ₹${minOrder}` : ""}`, prefix: "VIP" });
      d.notifications.push(note(u!.id, `A gift just for you 🎁 ${off}`, `${msg ? `${msg} ` : ""}Use code ${c} within ${days} days.`, "/shop"));
      return c;
    });
    revalidatePath(`/admin/customers/${userId}`);
    return { code };
  });
}
