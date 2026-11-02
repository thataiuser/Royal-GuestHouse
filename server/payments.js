// Mobile-money payments. PAYMENT_PROVIDER = off | manual | campay | mock
//   off    : only "pay on arrival"
//   manual : guest sends MoMo / Orange Money to your number, staff mark the booking as paid in the admin page
//   campay : automatic MTN MoMo and Orange Money collection through CamPay (https://campay.net)
//   mock   : demo provider that "succeeds" after 6 seconds (for testing only)
const crypto = require("crypto");
const provider = (process.env.PAYMENT_PROVIDER || "off").toLowerCase();
const info = {
  provider, holdMinutes: parseFloat(process.env.PAY_HOLD_MINUTES) || 60,
  momoNumber: process.env.MOMO_NUMBER || "", orangeNumber: process.env.ORANGE_NUMBER || "", accountName: process.env.MOMO_ACCOUNT_NAME || "Royal Guesthouse",
};
const auto = provider === "campay" || provider === "mock";
const msisdn = p => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); return d.length === 9 ? "237" + d : d; };

const base = (process.env.CAMPAY_BASE_URL || "https://demo.campay.net/api").replace(/\/$/, "");   // live: https://campay.net/api
let tok = null, tokAt = 0;
async function token(force) {
  if (!force && tok && Date.now() - tokAt < 45 * 60e3) return tok;
  const r = await fetch(base + "/token/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.CAMPAY_USERNAME, password: process.env.CAMPAY_PASSWORD }) });
  const d = await r.json().catch(() => ({}));
  if (!d.token) throw new Error("Payment provider login failed");
  tok = d.token; tokAt = Date.now(); return tok;
}
async function campay(path, opts = {}, retry = true) {
  const r = await fetch(base + path, { ...opts, headers: { "Content-Type": "application/json", Authorization: "Token " + (await token()) } });
  if (r.status === 401 && retry) { await token(true); return campay(path, opts, false); }
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

const mock = new Map();
async function collect({ amount, phone, description, reference }) {
  if (provider === "mock") { const ref = "MOCK-" + crypto.randomBytes(4).toString("hex"); mock.set(ref, { at: Date.now(), phone: msisdn(phone) }); return { providerRef: ref, ussd: "*126#", operator: "Demo" }; }
  const { ok, data } = await campay("/collect/", { method: "POST", body: JSON.stringify({ amount: String(amount), currency: "XAF", from: msisdn(phone), description, external_reference: reference }) });
  if (!ok || !data.reference) throw new Error(data.message || data.detail || "The payment request could not be started. Check the phone number.");
  return { providerRef: data.reference, ussd: data.ussd_code || "", operator: data.operator || "" };
}
async function status(providerRef) {   // PENDING | SUCCESSFUL | FAILED
  if (provider === "mock") { const m = mock.get(providerRef); return !m ? "FAILED" : Date.now() - m.at < 6000 ? "PENDING" : m.phone.endsWith("13") ? "FAILED" : "SUCCESSFUL"; }
  const { data } = await campay(`/transaction/${encodeURIComponent(providerRef)}/`);
  return data.status || "PENDING";
}
module.exports = { info, auto, collect, status };
