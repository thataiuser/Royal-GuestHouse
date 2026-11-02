// Diagnoses email problems. Usage:  node scripts/mail-test.js you@example.com
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const net = require("net"), dns = require("dns").promises, nodemailer = require("nodemailer");
const { sendMail, provider } = require("../server/mail");
const E = process.env, to = process.argv[2], p = provider();
const line = (ok, msg) => console.log((ok === true ? "  ✅ " : ok === false ? "  ❌ " : "  ℹ️  ") + msg);

function explain(e) {
  const m = `${e.code || ""} ${e.message || ""} ${e.response || ""}`;
  if (/EAUTH|535|Invalid login|Username and Password not accepted|BadCredentials|authentication/i.test(m)) return "The provider refused your username or password. Gmail needs a 16-character APP PASSWORD (not your normal password). Brevo needs the SMTP key, not your account password.";
  if (/ENOTFOUND|EAI_AGAIN/i.test(m)) return "The host name could not be found. Check SMTP_HOST for typos, and check that you are online.";
  if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|ECONNECTION|ECONNRESET|timed? ?out/i.test(m)) return "The connection was blocked or timed out. Your network, ISP or hosting probably blocks this SMTP port. Try another port from the list above, a different network (for example a phone hotspot), or switch to MAIL_PROVIDER=brevo or resend, which use normal HTTPS.";
  if (/sender|not verified|not valid|550|553|domain/i.test(m)) return "The provider does not accept the sender address. Set MAIL_FROM to an address you have verified with the provider.";
  if (/401|403|unauthorized|key/i.test(m)) return "The API key was refused. Check that you copied the whole key and that it is the right kind (API key for Brevo/Resend).";
  return "See the message above, or paste it to whoever is helping you.";
}
const tcp = (host, port) => new Promise(res => { const s = net.connect({ host, port, timeout: 6000 }); s.on("connect", () => { s.destroy(); res(true); }); s.on("timeout", () => { s.destroy(); res(false); }); s.on("error", () => res(false)); });

(async () => {
  console.log("\nEmail diagnostics\n");
  console.log("Settings read from .env:");
  line(null, `MAIL_PROVIDER  : ${E.MAIL_PROVIDER || "(not set)"}  → using "${p}"`);
  if (p === "dev") { line(false, "No email is configured, so the app only prints emails in the terminal. Set SMTP_HOST (or MAIL_PROVIDER plus an API key) in .env, then restart the server."); line(null, ".env must be named exactly .env (not .env.txt) and sit next to package.json."); return; }
  line(!!E.MAIL_FROM, `MAIL_FROM      : ${E.MAIL_FROM || "(not set)"}`);
  if (p === "smtp") {
    const host = (E.SMTP_HOST || "").trim(), port = +(E.SMTP_PORT || 587);
    line(!!host, `SMTP_HOST      : ${host}`); line(null, `SMTP_PORT      : ${port}`);
    line(!!E.SMTP_USER, `SMTP_USER      : ${E.SMTP_USER || "(not set)"}`); line(!!E.SMTP_PASS, `SMTP_PASS      : ${E.SMTP_PASS ? E.SMTP_PASS.length + " characters" : "(not set)"}`);
    if (/gmail/i.test(host) && E.SMTP_PASS && E.SMTP_PASS.replace(/\s/g, "").length !== 16) line(false, "Gmail app passwords have exactly 16 letters. Yours does not, so it is probably your normal password.");
    if (/gmail/i.test(host) && !/@(gmail|googlemail)\./i.test(E.SMTP_USER || "")) line(false, "SMTP_USER should be your full Gmail address.");
    if (/^["'].*["']$/.test(E.SMTP_PASS || "")) line(false, "SMTP_PASS contains quote marks. Remove them.");
    console.log("\nNetwork checks:");
    try { const a = await dns.lookup(host); line(true, `${host} resolves to ${a.address}`); } catch (e) { line(false, `Cannot find ${host}: ${e.code}`); }
    const ports = [587, 465, 2525, 25], open = await Promise.all(ports.map(pt => tcp(host, pt)));
    ports.forEach((pt, i) => line(open[i], `port ${pt} ${open[i] ? "is reachable" : "is blocked or unreachable"}${pt === port ? "   ← your current setting" : ""}`));
    console.log("\nLogin check:");
    try { await nodemailer.createTransport({ host, port, secure: port === 465, auth: E.SMTP_USER ? { user: E.SMTP_USER.trim(), pass: /gmail/i.test(host) ? (E.SMTP_PASS || "").replace(/\s+/g, "") : E.SMTP_PASS } : undefined, connectionTimeout: 12000, greetingTimeout: 12000 }).verify(); line(true, "Connected and logged in successfully."); }
    catch (e) { line(false, `${e.code || "error"}: ${e.message}`); console.log("\n  Meaning: " + explain(e)); }
  } else line(!!E[p === "brevo" ? "BREVO_API_KEY" : "RESEND_API_KEY"], `${p === "brevo" ? "BREVO_API_KEY" : "RESEND_API_KEY"}: ${E[p === "brevo" ? "BREVO_API_KEY" : "RESEND_API_KEY"] ? "set" : "(not set)"}`);
  if (!to) return console.log("\nTip: add an address to send a real test email:  node scripts/mail-test.js you@example.com\n");
  console.log(`\nSending a test email to ${to} ...`);
  try { await sendMail(to, "Test email", "If you can read this, email sending works.", "<p>If you can read this, <b>email sending works</b>.</p>"); line(true, "Sent! Check the inbox (and the spam folder) in a minute."); }
  catch (e) { line(false, `${e.code || "error"}: ${e.message}`); console.log("\n  Meaning: " + explain(e)); }
  console.log("");
})();
