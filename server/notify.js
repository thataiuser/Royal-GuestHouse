// Email (SMTP) and SMS (Twilio) notifications. With nothing configured, messages are printed to the console (dev mode).
const nodemailer = require("nodemailer");
const { SMTP_HOST, SMTP_PORT = 587, SMTP_USER, SMTP_PASS, MAIL_FROM, SMS_PROVIDER, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM,
  DEFAULT_COUNTRY_CODE = "237", ADMIN_NOTIFY_EMAIL, ADMIN_NOTIFY_PHONE } = process.env;

const mail = require("./mail");
const money = n => Number(n).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ") + " FCFA";
const e164 = p => { let d = String(p || "").replace(/[^\d+]/g, ""); if (d.startsWith("00")) d = "+" + d.slice(2); if (d.startsWith("+")) return d; return d.length === 9 ? "+" + DEFAULT_COUNTRY_CODE + d : "+" + d; };

async function email(to, subject, text) { if (!to) return; await mail.sendMail(to, subject, text); }
async function sms(to, text) {
  if (!to) return;
  const n = e164(to);
  if (SMS_PROVIDER !== "twilio") return console.log(`[DEV SMS] to ${n}: ${text}`);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64") },
    body: new URLSearchParams({ To: n, From: TWILIO_FROM, Body: text }),
  });
  if (!r.ok) throw new Error("SMS provider returned " + r.status);
}

function build(kind, b, site) {
  const detail = `Reference: ${b.ref}\nRoom: ${b.roomName}\nCheck-in: ${b.checkIn} from ${site.checkInTime}\nCheck-out: ${b.checkOut} by ${site.checkOutTime}\nGuests: ${b.guests}\nTotal: ${money(b.total)}`;
  const foot = `\n\nManage your booking on our website with your reference and email.\nQuestions? ${site.phone} ${site.email}\n${site.address}`;
  const short = `${b.roomName}, ${b.checkIn} to ${b.checkOut}`;
  const hold = (site.payments && site.payments.holdMinutes) || 60;
  const M = {
    created: [`Booking ${b.ref} confirmed – Royal Guesthouse`, `Hello ${b.name},\n\nYour booking is confirmed. Payment is due on arrival.\n\n${detail}${foot}`, `Royal Guesthouse: booking ${b.ref} confirmed. ${short}. Total ${money(b.total)}, pay on arrival.`],
    pending: [`Booking ${b.ref} reserved – payment needed`, `Hello ${b.name},\n\nYour room is reserved for ${hold} minutes. Please complete your mobile money payment to confirm it.\n\n${detail}${foot}`, `Royal Guesthouse: booking ${b.ref} reserved for ${hold} min. Pay ${money(b.total)} by mobile money to confirm.`],
    paid: [`Payment received – booking ${b.ref} confirmed`, `Hello ${b.name},\n\nThank you, we received your payment of ${money(b.total)}. Your booking is confirmed.\n\n${detail}${foot}`, `Royal Guesthouse: payment received, booking ${b.ref} confirmed. ${short}. See you soon!`],
    cancelled: [`Booking ${b.ref} cancelled`, `Hello ${b.name},\n\nYour booking ${b.ref} (${short}) has been cancelled.${foot}`, `Royal Guesthouse: booking ${b.ref} has been cancelled.`],
    expired: [`Booking ${b.ref} expired`, `Hello ${b.name},\n\nWe did not receive payment in time, so booking ${b.ref} (${short}) was released. You are welcome to book again.${foot}`, `Royal Guesthouse: booking ${b.ref} expired because payment was not received in time.`],
  };
  return M[kind];
}
// Guest + admin notices. Never throws, so a failed email can't break a booking.
async function send(kind, b, site) {
  try {
    const jobs = [];
    const m = build(kind, b, site);
    if (m) jobs.push(email(b.email, m[0], m[1]), sms(b.phone, m[2]));
    if (["created", "pending", "paid", "cancelled", "refund"].includes(kind)) {
      const note = `[${kind.toUpperCase()}] ${b.ref} · ${b.roomName} · ${b.checkIn} to ${b.checkOut} · ${b.name} ${b.phone} · ${money(b.total)}`;
      jobs.push(email(ADMIN_NOTIFY_EMAIL, `Royal Guesthouse: ${note}`, note + (kind === "refund" ? "\n\nThis guest PAID after the booking had expired. Please refund or rebook them." : "")), sms(ADMIN_NOTIFY_PHONE, note.slice(0, 300)));
    }
    (await Promise.allSettled(jobs)).forEach(r => r.status === "rejected" && console.warn("Notification failed:", r.reason.message));
  } catch (e) { console.warn("Notification error:", e.message); }
}
module.exports = { send };
