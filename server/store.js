const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  ref: { type: String, unique: true }, room: String, roomName: String, checkIn: String, checkOut: String, nights: Number, guests: Number, total: Number,
  name: String, email: String, phone: String, notes: String, status: { type: String, default: "confirmed" }, createdAt: { type: Date, default: Date.now },
  paymentStatus: { type: String, default: "unpaid" }, paymentMethod: String, providerRef: String, paidAt: Date, expiresAt: Date,
});
const Block = mongoose.model("Block", new mongoose.Schema({ room: String, checkIn: String, checkOut: String, reason: String, group: String, createdAt: { type: Date, default: Date.now } }));
// One document per booked night. The unique (room, date) index is what makes double booking impossible,
// even when two guests press "Book" at the same moment.
const nightSchema = new mongoose.Schema({ room: String, date: String, booking: mongoose.Schema.Types.ObjectId });
nightSchema.index({ room: 1, date: 1 }, { unique: true });
const Booking = mongoose.model("Booking", bookingSchema), Night = mongoose.model("Night", nightSchema);

let useDb = false, seq = 1;
const mem = { bookings: [], blocks: [], nights: new Map() };       // nights: "room|date" -> booking ref
const mode = () => (useDb ? "mongodb" : "memory");
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const crypto = require("crypto");
const conflict = () => Object.assign(new Error("Dates not available"), { code: "CONFLICT" });
const strictErr = last => Object.assign(new Error("Only after the last booking"), { code: "STRICT", from: last });
const clean = b => { if (!b) return null; const o = b.toObject ? b.toObject() : { ...b }; o.id = String(o._id); delete o._id; delete o.__v; return o; };

async function init(uri) {
  if (!uri) return console.warn("No MONGODB_URI set: using in-memory storage (bookings are lost on restart).");
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 7000 });
    await Promise.all([Booking.init(), Night.init(), Block.init()]);
    useDb = true; console.log("MongoDB connected");
  } catch (e) { console.warn(`MongoDB unavailable (${e.message}). Using in-memory storage: bookings are lost on restart.`); }
}

async function bookedNights(room, from) {
  if (useDb) return (await Night.find({ room, date: { $gte: from } }, "date").sort({ date: 1 }).lean()).map(n => n.date);
  return [...mem.nights.keys()].filter(k => k.startsWith(room + "|")).map(k => k.split("|")[1]).filter(d => d >= from).sort();
}
async function isFree(room, ci, co) {
  if (useDb) return !(await Night.exists({ room, date: { $gte: ci, $lt: co } }));
  for (let d = ci; d < co; d = addDays(d, 1)) if (mem.nights.has(`${room}|${d}`)) return false;
  return true;
}
async function lastCheckout(room) {
  if (useDb) { const n = await Night.findOne({ room }).sort({ date: -1 }).lean(); return n ? addDays(n.date, 1) : null; }
  const ds = [...mem.nights.keys()].filter(k => k.startsWith(room + "|")).map(k => k.split("|")[1]).sort();
  return ds.length ? addDays(ds[ds.length - 1], 1) : null;
}

async function create(b, nights, strict) {
  if (strict) { const last = await lastCheckout(b.room); if (last && b.checkIn < last) throw strictErr(last); }
  if (!useDb) {   // no await between the check and the writes, so this block can never interleave
    if (nights.some(d => mem.nights.has(`${b.room}|${d}`))) throw conflict();
    const doc = { ...b, _id: String(seq++) }; mem.bookings.push(doc); nights.forEach(d => mem.nights.set(`${b.room}|${d}`, b.ref)); return clean(doc);
  }
  const doc = await Booking.create(b);
  try { await Night.insertMany(nights.map(date => ({ room: b.room, date, booking: doc._id })), { ordered: true }); }
  catch (e) {
    await Night.deleteMany({ booking: doc._id }); await Booking.deleteOne({ _id: doc._id });
    if (e.code === 11000 || (e.writeErrors || []).some(w => w.code === 11000)) throw conflict();
    throw e;
  }
  return clean(doc);
}
async function byRef(ref) { return useDb ? clean(await Booking.findOne({ ref })) : clean(mem.bookings.find(b => b.ref === ref)); }
async function cancel(ref) {
  const b = await byRef(ref); if (!b || b.status === "cancelled") return null;
  if (useDb) { await Night.deleteMany({ booking: b.id }); await Booking.updateOne({ ref }, { status: "cancelled" }); }
  else { for (const [k, v] of mem.nights) if (v === ref) mem.nights.delete(k); mem.bookings.find(x => x.ref === ref).status = "cancelled"; }
  return { ...b, status: "cancelled" };
}
async function all() {
  const rows = useDb ? await Booking.find().sort({ checkIn: -1 }).limit(1000) : [...mem.bookings].sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
  return rows.map(clean);
}
async function update(ref, patch) {
  if (useDb) return clean(await Booking.findOneAndUpdate({ ref }, { $set: patch }, { new: true }));
  const b = mem.bookings.find(x => x.ref === ref); if (!b) return null; Object.assign(b, patch); return clean(b);
}
async function pendingExpired(now) {
  const rows = useDb ? await Booking.find({ status: "pending_payment", expiresAt: { $lt: now } }) : mem.bookings.filter(b => b.status === "pending_payment" && b.expiresAt && new Date(b.expiresAt) < now);
  return rows.map(clean);
}
async function conflictsFor(rooms, ci, co) {
  const act = ["confirmed", "pending_payment"];
  const rows = useDb ? await Booking.find({ room: { $in: rooms }, status: { $in: act }, checkIn: { $lt: co }, checkOut: { $gt: ci } })
    : mem.bookings.filter(b => rooms.includes(b.room) && act.includes(b.status) && b.checkIn < co && b.checkOut > ci);
  return rows.map(clean);
}
// Maintenance blocks reuse the same unique night records, so a blocked night can never be booked.
async function removeBlock(id) {
  if (useDb) { if (!mongoose.isValidObjectId(id)) return false; await Night.deleteMany({ booking: id }); return !!(await Block.findByIdAndDelete(id)); }
  const i = mem.blocks.findIndex(b => b._id === id); if (i < 0) return false;
  for (const [k, v] of mem.nights) if (v === "BLOCK:" + id) mem.nights.delete(k); mem.blocks.splice(i, 1); return true;
}
async function createBlocks(rooms, ci, co, reason, nights) {
  const group = crypto.randomBytes(4).toString("hex"), made = [];
  try {
    for (const room of rooms) {
      if (useDb) {
        const blk = await Block.create({ room, checkIn: ci, checkOut: co, reason, group }); made.push(blk);
        try { await Night.insertMany(nights.map(date => ({ room, date, booking: blk._id })), { ordered: true }); }
        catch (e) { if (e.code === 11000 || (e.writeErrors || []).some(w => w.code === 11000)) throw conflict(); throw e; }
      } else {
        if (nights.some(d => mem.nights.has(`${room}|${d}`))) throw conflict();
        const blk = { _id: String(seq++), room, checkIn: ci, checkOut: co, reason, group, createdAt: new Date() };
        mem.blocks.push(blk); made.push(blk); nights.forEach(d => mem.nights.set(`${room}|${d}`, "BLOCK:" + blk._id));
      }
    }
  } catch (e) { for (const b of made) await removeBlock(String(b._id)); throw e; }
  return made.map(clean);
}
async function listBlocks() {
  const rows = useDb ? await Block.find().sort({ checkIn: 1 }).lean() : [...mem.blocks].sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1));
  return rows.map(clean);
}
module.exports = { init, bookedNights, isFree, create, byRef, cancel, all, mode, addDays, update, pendingExpired, conflictsFor, createBlocks, removeBlock, listBlocks };
