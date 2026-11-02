// Sends email through SMTP, or through an HTTPS email API (Brevo or Resend).
// HTTPS APIs keep working when your network or host blocks the SMTP ports.
const nodemailer = require("nodemailer");

let transport = null, tkey = "";
function smtp() {
  const { SMTP_HOST, SMTP_PORT = "587", SMTP_USER, SMTP_PASS = "" } = process.env;
  const pass = /gmail|google/i.test(SMTP_HOST || "") ? SMTP_PASS.replace(/\s+/g, "") : SMTP_PASS;   // Gmail shows app passwords with spaces
  const k = [SMTP_HOST, SMTP_PORT, SMTP_USER, pass].join("|");
  if (!transport || k !== tkey) {
    tkey = k;
    transport = nodemailer.createTransport({
      host: SMTP_HOST.trim(), port: +SMTP_PORT, secure: +SMTP_PORT === 465, auth: SMTP_USER ? { user: SMTP_USER.trim(), pass } : undefined,
      connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000,   // fail fast instead of hanging when a port is blocked
    });
  }
  return transport;
}
const provider = () => (process.env.MAIL_PROVIDER || "").toLowerCase() || (process.env.SMTP_HOST ? "smtp" : "dev");
function parseFrom(f) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(f || "");
  return m ? { name: m[1].trim() || "Royal Guesthouse", email: m[2].trim() } : { name: "CyberShield", email: String(f || process.env.SMTP_USER || "").trim() };
}
async function post(url, headers, body) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url.includes("brevo") ? "Brevo" : "Resend"} API error ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function sendMail(to, subject, text, html) {
  const p = provider(), from = process.env.MAIL_FROM || process.env.SMTP_USER;
  if (p === "brevo") {
    const f = parseFrom(from);
    await post("https://api.brevo.com/v3/smtp/email", { "api-key": process.env.BREVO_API_KEY || "", accept: "application/json" },
      { sender: { name: f.name, email: f.email }, to: [{ email: to }], subject, textContent: text, ...(html ? { htmlContent: html } : {}) });
  } else if (p === "resend") {
    await post("https://api.resend.com/emails", { Authorization: "Bearer " + (process.env.RESEND_API_KEY || "") }, { from, to: [to], subject, text, ...(html ? { html } : {}) });
  } else if (p === "smtp") {
    await smtp().sendMail({ from, to, subject, text, html });
  } else {
    console.log(`\n[DEV MAIL – email is not configured, so this was only printed]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
  }
  return p;
}
module.exports = { sendMail, provider, parseFrom };
