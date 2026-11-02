require("dotenv").config();
const path = require("path"), crypto = require("crypto");
const express = require("express"), helmet = require("helmet"), rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser"), jwt = require("jsonwebtoken");
const ROOMS = require("./rooms"), store = require("./store"), notify = require("./notify"), pay = require("./payments");

const { ADMIN_PASSWORD, COOKIE_SECURE, GUESTHOUSE_PHONE, GUESTHOUSE_EMAIL, GUESTHOUSE_ADDRESS } = process.env;
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const STRICT = process.env.STRICT_AFTER_LAST === "true";
const SITE = { name: "Royal Guesthouse", phone: GUESTHOUSE_PHONE || "", email: GUESTHOUSE_EMAIL || "", address: GUESTHOUSE_ADDRESS || "", checkInTime: "14:00", checkOutTime: "11:00", strict: STRICT, payments: pay.info, tour: require("./media").tour };

const app = express();
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { "upgrade-insecure-requests": null } } }));
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const pollLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

const today = () => new Date().toISOString().slice(0, 10);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const nightsOf = (ci, co) => { const out = []; for (let d = ci; d < co && out.length < 400; d = store.addDays(d, 1)) out.push(d); return out; };
const makeRef = () => "RG-" + Array.from(crypto.randomBytes(6), b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
const nextFree = (booked, from) => { let d = from; for (const x of booked) { if (x < d) continue; if (x === d) d = store.addDays(d, 1); else break; } return d; };
const strip = b => b && ({ ref: b.ref, room: b.room, roomName: b.roomName, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, guests: b.guests, total: b.total, name: b.name, email: b.email, phone: b.phone, notes: b.notes, status: b.status, paymentStatus: b.paymentStatus, paymentMethod: b.paymentMethod, expiresAt: b.expiresAt, room: b.room });

app.get("/api/site", (req, res) => res.json(SITE));
app.get("/api/rooms", wrap(async (req, res) => {
  res.json(await Promise.all(ROOMS.map(async r => ({ ...r, nextFree: nextFree(await store.bookedNights(r.id, today()), today()) }))));
}));
app.get("/api/rooms/:id/booked", wrap(async (req, res) => {
  if (!ROOMS.some(r => r.id === req.params.id)) return res.status(404).json({ error: "Room not found" });
  const booked = await store.bookedNights(req.params.id, today());
  res.json({ booked, nextFree: nextFree(booked, today()) });
}));
app.get("/api/availability", wrap(async (req, res) => {
  const { checkIn, checkOut } = req.query, guests = parseInt(req.query.guests, 10) || 1;
  if (!isDate(checkIn) || !isDate(checkOut) || checkOut <= checkIn) return res.status(400).json({ error: "Choose a valid check-in and check-out date" });
  res.json(await Promise.all(ROOMS.map(async r => ({ id: r.id, available: r.capacity >= guests && checkIn >= today() && (await store.isFree(r.id, checkIn, checkOut)) }))));
}));

app.post("/api/bookings", limiter, wrap(async (req, res) => {
  const b = req.body || {}, room = ROOMS.find(r => r.id === b.roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (!isDate(b.checkIn) || !isDate(b.checkOut) || b.checkOut <= b.checkIn) return res.status(400).json({ error: "Check-out must be after check-in" });
  if (b.checkIn < today()) return res.status(400).json({ error: "Check-in cannot be in the past" });
  const nights = nightsOf(b.checkIn, b.checkOut);
  if (nights.length > 30) return res.status(400).json({ error: "Maximum stay is 30 nights" });
  const guests = parseInt(b.guests, 10), name = String(b.name || "").trim(), email = String(b.email || "").trim().toLowerCase(), phone = String(b.phone || "").trim();
  if (!(guests >= 1 && guests <= room.capacity)) return res.status(400).json({ error: `This room sleeps up to ${room.capacity} guests` });
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Please enter your full name" });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address" });
  if (!/^[+\d][\d\s()-]{5,24}$/.test(phone)) return res.status(400).json({ error: "Please enter a valid phone number" });
  try {
    const online = b.payMethod === "momo" && pay.info.provider !== "off";
    const saved = await store.create({ ref: makeRef(), room: room.id, roomName: room.name, checkIn: b.checkIn, checkOut: b.checkOut, nights: nights.length, guests,
      total: nights.length * room.price, name, email, phone, notes: String(b.notes || "").slice(0, 500), status: online ? "pending_payment" : "confirmed", paymentStatus: "unpaid", paymentMethod: online ? "momo" : "arrival",
      expiresAt: online ? new Date(Date.now() + pay.info.holdMinutes * 60000) : null, createdAt: new Date() }, nights, STRICT);
    notify.send(online ? "pending" : "created", saved, SITE);
    res.status(201).json(strip(saved));
  } catch (e) {
    if (e.code === "CONFLICT") return res.status(409).json({ error: "Sorry, this room is already booked for some of those dates. Please pick other dates." });
    if (e.code === "STRICT") return res.status(409).json({ error: `This room can only be booked from ${e.from} onwards, after its latest booking.` });
    throw e;
  }
}));

const find = async (ref, email) => { const b = await store.byRef(String(ref || "").trim().toUpperCase()); return b && b.email === String(email || "").trim().toLowerCase() ? b : null; };
app.get("/api/bookings/lookup", limiter, wrap(async (req, res) => {
  const b = await find(req.query.ref, req.query.email); b ? res.json(strip(b)) : res.status(404).json({ error: "No booking found for that reference and email" });
}));
app.post("/api/bookings/cancel", limiter, wrap(async (req, res) => {
  const b = await find(req.body.ref, req.body.email);
  if (!b) return res.status(404).json({ error: "No booking found for that reference and email" });
  if (b.checkIn < today()) return res.status(400).json({ error: "Past or ongoing stays can't be cancelled online. Please call us." });
  const out = await store.cancel(b.ref); if (out) notify.send("cancelled", out, SITE); out ? res.json(strip(out)) : res.status(400).json({ error: "This booking is already cancelled" });
}));

// ---- payments ----
const markPaid = async (b, method) => {
  const out = await store.update(b.ref, { status: "confirmed", paymentStatus: "paid", paymentMethod: method, paidAt: new Date(), expiresAt: null });
  notify.send("paid", out, SITE); return out;
};
app.post("/api/bookings/:ref/pay", limiter, wrap(async (req, res) => {
  const b = await find(req.params.ref, req.body.email);
  if (!b) return res.status(404).json({ error: "Booking not found" });
  if (b.status !== "pending_payment") return res.status(400).json({ error: b.status === "cancelled" ? "This booking expired or was cancelled. Please book again." : "This booking needs no payment right now" });
  if (pay.info.provider === "off") return res.status(400).json({ error: "Online payment is not available" });
  if (pay.info.provider === "manual") return res.json({ mode: "manual", amount: b.total });
  const phone = req.body.phone || b.phone;
  try {
    const r = await pay.collect({ amount: b.total, phone, description: `Royal Guesthouse ${b.ref}`, reference: b.ref });
    await store.update(b.ref, { paymentStatus: "pending", paymentMethod: "momo", providerRef: r.providerRef });
    res.json({ mode: pay.info.provider, ussd: r.ussd, operator: r.operator, phone });
  } catch (e) { res.status(502).json({ error: e.message || "The payment request failed" }); }
}));
app.get("/api/bookings/:ref/payment", pollLimiter, wrap(async (req, res) => {
  let b = await find(req.params.ref, req.query.email);
  if (!b) return res.status(404).json({ error: "Booking not found" });
  if (b.paymentStatus === "pending" && b.providerRef && pay.auto) {
    const s = await pay.status(b.providerRef).catch(() => "PENDING");
    if (s === "SUCCESSFUL") {
      if (b.status === "cancelled") { b = await store.update(b.ref, { paymentStatus: "paid", paidAt: new Date() }); notify.send("refund", b, SITE); }
      else b = await markPaid(b, "momo");
    } else if (s === "FAILED") b = await store.update(b.ref, { paymentStatus: "failed" });
  }
  res.json({ status: b.status, paymentStatus: b.paymentStatus });
}));
// Unpaid online bookings release their dates after the hold time (unless the provider says they were paid)
async function sweep() {
  for (const b of await store.pendingExpired(new Date())) {
    if (b.providerRef && pay.auto) { const s = await pay.status(b.providerRef).catch(() => ""); if (s === "SUCCESSFUL") { await markPaid(b, "momo"); continue; } }
    const out = await store.cancel(b.ref); if (out) notify.send("expired", out, SITE);
  }
}
setInterval(() => sweep().catch(e => console.error("Expiry sweep failed:", e.message)), (parseFloat(process.env.EXPIRY_CHECK_SECONDS) || 60) * 1000);

// ---- admin ----
const hash = s => crypto.createHash("sha256").update(String(s)).digest();
app.post("/api/admin/login", limiter, (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "Admin is disabled. Set ADMIN_PASSWORD in .env" });
  if (!crypto.timingSafeEqual(hash(req.body.password), hash(ADMIN_PASSWORD))) return res.status(401).json({ error: "Wrong password" });
  res.cookie("admin", jwt.sign({ admin: true }, SECRET, { expiresIn: "12h" }), { httpOnly: true, sameSite: "strict", secure: COOKIE_SECURE === "true", maxAge: 12 * 36e5 });
  res.json({ ok: true });
});
app.post("/api/admin/logout", (req, res) => { res.clearCookie("admin"); res.json({ ok: true }); });
const admin = (req, res, next) => { try { jwt.verify(req.cookies.admin || "", SECRET); next(); } catch { res.status(401).json({ error: "Please log in" }); } };
app.get("/api/admin/bookings", admin, wrap(async (req, res) => res.json((await store.all()).map(strip))));
app.post("/api/admin/bookings/:ref/cancel", admin, wrap(async (req, res) => {
  const out = await store.cancel(req.params.ref); if (out) notify.send("cancelled", out, SITE); out ? res.json(strip(out)) : res.status(404).json({ error: "Booking not found or already cancelled" });
}));

app.post("/api/admin/bookings/:ref/paid", admin, wrap(async (req, res) => {
  const b = await store.byRef(req.params.ref);
  if (!b || b.status === "cancelled") return res.status(404).json({ error: "Booking not found" });
  res.json(strip(b.paymentStatus === "paid" ? b : await markPaid(b, req.body.method === "momo" ? "momo" : "cash")));
}));
// Block rooms for maintenance or private use
app.get("/api/admin/blocks", admin, wrap(async (req, res) => res.json(await store.listBlocks())));
app.post("/api/admin/blocks", admin, wrap(async (req, res) => {
  const { room, checkIn, checkOut } = req.body || {}, reason = String(req.body.reason || "Maintenance").trim().slice(0, 100) || "Maintenance";
  if (!isDate(checkIn) || !isDate(checkOut) || checkOut <= checkIn) return res.status(400).json({ error: "Choose a valid start date and an end date after it" });
  if (checkIn < today()) return res.status(400).json({ error: "The start date cannot be in the past" });
  const rooms = room === "all" ? ROOMS.map(r => r.id) : ROOMS.filter(r => r.id === room).map(r => r.id);
  if (!rooms.length) return res.status(404).json({ error: "Room not found" });
  const nights = nightsOf(checkIn, checkOut); if (nights.length > 365) return res.status(400).json({ error: "A block can last at most 365 nights" });
  try { res.status(201).json(await store.createBlocks(rooms, checkIn, checkOut, reason, nights)); }
  catch (e) {
    if (e.code !== "CONFLICT") throw e;
    const c = await store.conflictsFor(rooms, checkIn, checkOut);
    res.status(409).json({ error: "Some of these dates already have bookings or blocks. Cancel or move the bookings first.", conflicts: c.map(x => ({ ref: x.ref, room: x.roomName, checkIn: x.checkIn, checkOut: x.checkOut, name: x.name })) });
  }
}));
app.delete("/api/admin/blocks/:id", admin, wrap(async (req, res) => (await store.removeBlock(req.params.id)) ? res.json({ ok: true }) : res.status(404).json({ error: "Block not found" })));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: "Something went wrong. Please try again." }); });

const PORT = process.env.PORT || 3000;
store.init(process.env.MONGODB_URI).then(() => app.listen(PORT, () => console.log(`Royal Guesthouse running on http://localhost:${PORT} (storage: ${store.mode()}${STRICT ? ", strict mode" : ""})`)));
