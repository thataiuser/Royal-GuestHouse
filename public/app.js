const $ = s => document.querySelector(s), app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = n => Number(n).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ") + " FCFA";
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nightsBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const fmt = s => new Date(s + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const TODAY = iso(new Date());
let SITE = {}, ROOMS = [];

async function api(p, body) {
  const r = await fetch("/api" + p, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "Request failed"), { status: r.status, conflicts: d.conflicts });
  return d;
}
const EMO = [[/air|fan/i, "❄️"], [/wi-?fi/i, "📶"], [/tv/i, "📺"], [/bath|shower/i, "🚿"], [/kitchen/i, "🍳"], [/balcony|terrace|garden/i, "🌿"], [/breakfast/i, "🥐"], [/parking/i, "🅿️"], [/fridge/i, "🧊"], [/desk/i, "💼"], [/washing/i, "🧺"], [/lounge|living/i, "🛋️"]];
const amen = a => `<div>${(EMO.find(([r]) => r.test(a)) || [0, "✔️"])[1]} ${esc(a)}</div>`;
const nextLabel = d => d <= TODAY ? "today" : d === addDays(TODAY, 1) ? "tomorrow" : fmt(d);

function carHTML(photos, o = {}) {
  return `<div class="car ${o.cls || ""}"><div class="car-track">${photos.map((p, i) => `<img src="${o.thumb ? (p.thumb || p.src) : p.src}" alt="${esc(p.alt)}" draggable="false" ${i ? 'loading="lazy"' : ""}>`).join("")}</div>
  <button class="car-btn prev" aria-label="Previous photo" type="button">‹</button><button class="car-btn next" aria-label="Next photo" type="button">›</button>
  <div class="car-count">1 / ${photos.length}</div><div class="car-dots">${photos.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div></div>`;
}
// Swipeable carousel: touch uses the browser's native swipe (scroll-snap); mouse users can drag, use the arrows or the keyboard arrow keys
function bindCar(el, onIndex, onTap) {
  const tr = el.querySelector(".car-track"), n = tr.children.length; let idx = 0, down = null, moved = false;
  const set = i => { idx = i; el.querySelector(".car-count").textContent = `${i + 1} / ${n}`; el.querySelectorAll(".car-dots i").forEach((d, k) => d.classList.toggle("on", k === i)); if (onIndex) onIndex(i); };
  const go = i => tr.scrollTo({ left: ((i + n) % n) * tr.clientWidth, behavior: "smooth" });
  tr.addEventListener("scroll", () => { const i = Math.round(tr.scrollLeft / (tr.clientWidth || 1)); if (i !== idx && i >= 0 && i < n) set(i); }, { passive: true });
  el.querySelector(".prev").onclick = e => { e.stopPropagation(); go(idx - 1); }; el.querySelector(".next").onclick = e => { e.stopPropagation(); go(idx + 1); };
  tr.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") return; down = { x: e.clientX, left: tr.scrollLeft }; moved = false; tr.classList.add("drag"); try { tr.setPointerCapture(e.pointerId); } catch {} });
  tr.addEventListener("pointermove", e => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 5) moved = true; tr.scrollLeft = down.left - dx; });
  const up = () => { if (!down) return; down = null; tr.classList.remove("drag"); if (moved) tr.scrollTo({ left: Math.round(tr.scrollLeft / (tr.clientWidth || 1)) * tr.clientWidth, behavior: "smooth" }); };
  tr.addEventListener("pointerup", up); tr.addEventListener("pointercancel", up);
  tr.addEventListener("click", () => { if (moved) { moved = false; return; } if (onTap) onTap(idx); });
  el.tabIndex = 0; el.addEventListener("keydown", e => { if (e.key === "ArrowLeft") go(idx - 1); if (e.key === "ArrowRight") go(idx + 1); });
  return { go, set: i => { tr.scrollTo({ left: i * tr.clientWidth }); set(i); } };
}
function gallery(r) {
  if (!r.photos || !r.photos.length) return `<img class="big" src="/img/room-${r.id}.svg" alt="${esc(r.name)}">`;
  return `<div class="gal">${carHTML(r.photos, { cls: "bigcar" })}<div class="thumbs">${r.photos.map((p, i) => `<img data-i="${i}" class="${i ? "" : "on"}" src="${p.thumb || p.src}" alt="${esc(p.alt)}" loading="lazy">`).join("")}</div>
  <p class="note" id="gc">Swipe or use the arrows to see all ${r.photos.length} photos · tap a photo to enlarge</p></div>`;
}
function bindGallery(r) {
  const el = document.querySelector(".gal .car"); if (!el) return;
  const thumbs = [...document.querySelectorAll(".thumbs img")];
  const car = bindCar(el, i => thumbs.forEach((t, k) => t.classList.toggle("on", k === i)), idx => lightbox(r.photos, idx, i => car.set(i)));
  thumbs.forEach(t => t.onclick = () => car.go(+t.dataset.i));
}
function lightbox(photos, start, onChange) {
  const box = document.createElement("div"); box.id = "lbx";
  box.innerHTML = `<div class="lb-track">${photos.map(p => `<div class="lb-slide"><img src="${p.src}" alt="${esc(p.alt)}" draggable="false"></div>`).join("")}</div><button class="lx" id="lc" aria-label="Close" type="button">✕</button><button class="lx lp" aria-label="Previous" type="button">‹</button><button class="lx ln" aria-label="Next" type="button">›</button><div class="lcap"></div>`;
  document.body.appendChild(box); document.body.style.overflow = "hidden";
  const tr = box.querySelector(".lb-track"), cap = box.querySelector(".lcap"); let i = start;
  const label = () => { cap.textContent = `${photos[i].alt} (${i + 1}/${photos.length})`; };
  const go = d => tr.scrollTo({ left: ((i + d + photos.length) % photos.length) * tr.clientWidth, behavior: "smooth" });
  tr.scrollLeft = start * tr.clientWidth; label();
  tr.addEventListener("scroll", () => { const k = Math.round(tr.scrollLeft / (tr.clientWidth || 1)); if (k !== i && k >= 0 && k < photos.length) { i = k; label(); if (onChange) onChange(i); } }, { passive: true });
  const key = e => { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); };
  function close() { document.removeEventListener("keydown", key); document.body.style.overflow = ""; box.remove(); }
  document.addEventListener("keydown", key);
  box.querySelector("#lc").onclick = close; box.querySelector(".lp").onclick = () => go(-1); box.querySelector(".ln").onclick = () => go(1);
  box.addEventListener("click", e => { if (e.target === box || e.target.classList.contains("lb-slide")) close(); });
}
function cardMedia(r) {
  if (r.photos && r.photos.length > 1) return carHTML(r.photos, { thumb: true, cls: "cardcar" });
  return `<img src="${r.cover || `/img/room-${r.id}.svg`}" alt="${esc(r.name)}" loading="lazy">`;
}
function bindCards() {
  document.querySelectorAll(".rc .car").forEach(el => bindCar(el, null, () => { location.hash = el.closest(".rc").querySelector("a.btn").getAttribute("href"); }));
}
function tourSection() {
  if (!SITE.tour || !SITE.tour.length) return "";
  return `<section class="tourband"><div class="tourin"><div class="eyebrow">Virtual tour</div><h2>Take a tour of the guesthouse</h2>
  <p class="mute">Walk through the apartment before you book. Press play, or use full screen for the biggest view.</p>
  ${SITE.tour.map((v, i) => `<div class="stage"><div class="stagebg" style="background-image:url('${v.poster}')"></div><video controls playsinline preload="metadata" poster="${v.poster}"><source src="${v.src}" type="video/mp4">Your browser cannot play this video.</video>
  <div class="stagecap">${i + 1}. ${esc(v.title)}</div><button class="fsbtn" type="button">⛶ Full screen</button></div>`).join("")}</div></section>`;
}
function bindTour() {
  const vids = [...document.querySelectorAll(".stage video")]; vids.forEach(v => v.onplay = () => vids.forEach(o => o !== v && o.pause()));
  document.querySelectorAll(".fsbtn").forEach(b => b.onclick = () => { const v = b.parentElement.querySelector("video"), f = v.requestFullscreen || v.webkitRequestFullscreen || v.webkitEnterFullscreen; if (f) f.call(v); });
}
function roomCard(r, av, qs) {
  const badge = av === undefined ? `<span class="badge info">Next available: ${nextLabel(r.nextFree)}</span>` :
    av ? `<span class="badge ok">Available for your dates</span>` : `<span class="badge no">Not available · next free ${nextLabel(r.nextFree)}</span>`;
  return `<article class="card rc" data-id="${r.id}">${cardMedia(r)}<div class="pad"><h3>${esc(r.name)}</h3><span class="mute">${esc(r.tagline)}</span>
  <div class="chips"><span class="chip">👥 up to ${r.capacity}</span><span class="chip">🛏️ ${esc(r.beds)}</span>${r.size ? `<span class="chip">${r.size} m²</span>` : ""}</div>${badge}
  <div class="price">${money(r.price)} <small>/ night</small></div><a class="btn" href="#/room/${r.id}${qs || ""}">View &amp; book</a></div></article>`;
}
function searchForm(v = {}) {
  return `<form class="search" id="sf"><div><label>Check-in</label><input type="date" id="ci" min="${TODAY}" value="${v.in || ""}" required></div>
  <div><label>Check-out</label><input type="date" id="co" min="${addDays(TODAY, 1)}" value="${v.out || ""}" required></div>
  <div><label>Guests</label><select id="gu">${[1, 2, 3, 4, 5].map(n => `<option ${+v.guests === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
  <button class="btn">Check availability</button></form>`;
}
function bindSearch() {
  const ci = $("#ci"), co = $("#co");
  ci.onchange = () => { co.min = addDays(ci.value || TODAY, 1); if (co.value && co.value <= ci.value) co.value = addDays(ci.value, 1); };
  $("#sf").onsubmit = e => { e.preventDefault(); location.hash = `#/rooms?in=${ci.value}&out=${co.value}&guests=${$("#gu").value}`; };
}

/* ---------- pages ---------- */
function home() {
  app.innerHTML = `<section class="hero"><div class="in"><div><div class="eyebrow">Fully furnished · Comfortable · Secure</div><h1>Your royal home away from home</h1>
  <p>Beautiful rooms and apartments with air conditioning. See what's available and book online in under a minute.</p>${searchForm()}</div>
  <img class="herologo" src="/img/logo.jpg" alt="Royal Guest House logo"></div></section>
  <div class="wrap"><div class="feat">
  <div class="card"><div class="e">🛋️</div><h3>Fully furnished</h3><p class="mute">Every room is ready to live in: quality beds, wardrobes, TV and fresh linen.</p></div>
  <div class="card"><div class="e">💂‍♂️</div><h3>24/7 security               </h3><p class="mute"> 24/7 security for a worry-free stay.</p></div>
  <div class="card"><div class="e">🅿</div><h3>Safe Parking</h3><p class="mute">Spacious and safe parking spot available.</p></div>
  <div class="card"><div class="e">🔒</div><h3>Guaranteed booking</h3><p class="mute">Dates you book are reserved for you alone. Double bookings are impossible.</p></div></div>
  ${tourSection()}
  <h2>Our rooms</h2><p class="mute">A selection of our rooms. <a href="#/rooms">See all rooms →</a></p><div class="grid">${ROOMS.slice(0, 3).map(r => roomCard(r)).join("")}</div></div>`;
  bindSearch();
  bindCards(); bindTour();
}

async function roomsPage(q) {
  const v = { in: q.get("in") || "", out: q.get("out") || "", guests: q.get("guests") || 2 }, has = v.in && v.out && v.out > v.in;
  let av = {};
  if (has) (await api(`/availability?checkIn=${v.in}&checkOut=${v.out}&guests=${v.guests}`)).forEach(x => av[x.id] = x.available);
  const list = has ? [...ROOMS].sort((a, b) => av[b.id] - av[a.id]) : ROOMS, free = list.filter(r => av[r.id]).length;
  app.innerHTML = `<div class="wrap"><h1>Rooms and apartments</h1>${searchForm(v)}
  ${has ? `<p style="margin:16px 0"><b>${free}</b> of ${ROOMS.length} rooms available from <b>${fmt(v.in)}</b> to <b>${fmt(v.out)}</b> for ${v.guests} guest(s).</p>` : `<p class="mute" style="margin:16px 0">Choose your dates to see what's free, or browse all rooms below.</p>`}
  <div class="grid">${list.map(r => roomCard(r, has ? av[r.id] : undefined, has ? `?in=${v.in}&out=${v.out}&guests=${v.guests}` : "")).join("")}</div></div>`;
  bindSearch(); bindCards();
}

function calendar(el, booked, onChange) {
  const B = new Set(booked); let view = new Date(); view.setDate(1); let ci = null, co = null, msg = "";
  const limit = () => { for (let d = addDays(ci, 1); d < addDays(ci, 400); d = addDays(d, 1)) if (B.has(d)) return d; return null; };
  const draw = () => {
    const y = view.getFullYear(), m = view.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), lim = ci && !co ? limit() : null;
    let cells = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => `<div class="dow">${d}</div>`).join("") + "<span></span>".repeat(first);
    for (let i = 1; i <= days; i++) {
      const d = `${y}-${pad(m + 1)}-${pad(i)}`, past = d < TODAY, bk = B.has(d);
      const blk = ci && !co && d > ci && lim && d > lim, inr = ci && co && d > ci && d < co, sel = d === ci || d === co;
      cells += `<button type="button" data-d="${d}" class="${past ? "past" : ""} ${bk ? "booked" : ""} ${sel ? "sel" : inr ? "in" : ""} ${blk ? "blk" : ""}" ${past || (bk && !(ci && !co && d === lim)) || blk ? "disabled" : ""}>${i}</button>`;
    }
    el.innerHTML = `<div class="cal"><div class="calh"><button type="button" id="pm" ${y === new Date().getFullYear() && m === new Date().getMonth() ? "disabled" : ""}>‹</button>
    <b>${view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><button type="button" id="nm">›</button></div><div class="cg">${cells}</div>
    <div class="legend"><span><i class="lg1"></i>Booked</span><span><i class="lg2"></i>Your dates</span><span><i class="lg3"></i>Free</span></div>
    <p class="note" style="margin:6px 0 0">${msg || (!ci ? "Select your check-in date." : !co ? "Now select your check-out date." : "Click a date to change your dates.")}</p></div>`;
    el.querySelector("#pm").onclick = () => { view.setMonth(m - 1); draw(); };
    el.querySelector("#nm").onclick = () => { view.setMonth(m + 1); draw(); };
    el.querySelectorAll("[data-d]").forEach(b => b.onclick = () => pick(b.dataset.d));
  };
  const pick = d => {
    msg = "";
    if (!ci || co || d <= ci) { if (B.has(d)) return; ci = d; co = null; }
    else { const l = limit(); if (l && d > l) { msg = "That range includes a booked night."; return draw(); } co = d; }
    onChange(ci, co); draw();
  };
  return { draw, set(a, b) { ci = a; co = b; if (a) { view = new Date(a + "T00:00:00"); view.setDate(1); } onChange(ci, co); draw(); }, reset() { ci = co = null; onChange(null, null); }, update(b) { B.clear(); b.forEach(x => B.add(x)); draw(); } };
}

async function roomPage(id, q) {
  const r = ROOMS.find(x => x.id === id); if (!r) return notFound();
  let { booked } = await api(`/rooms/${id}/booked`), ci = null, co = null;
  app.innerHTML = `<div class="wrap"><p><a href="#/rooms">← All rooms</a></p><div class="two"><div>
  ${gallery(r)}<h1 style="margin-top:18px">${esc(r.name)}</h1><p class="mute">${esc(r.tagline)}</p>
  <div class="chips"><span class="chip">👥 up to ${r.capacity} guests</span><span class="chip">🛏️ ${esc(r.beds)}</span>${r.size ? `<span class="chip">${r.size} m²</span>` : ""}</div>
  <p style="margin-top:14px">${esc(r.description)}</p><h3>What's included</h3><div class="amen">${r.amenities.map(amen).join("")}</div>
  <h3>Good to know</h3><ul><li>Check-in from ${SITE.checkInTime}, check-out by ${SITE.checkOutTime}.</li><li>A guest can check in on the same day the previous guest checks out.</li>
  <li>Free cancellation online until the day of arrival.</li><li>Booked dates are reserved exclusively for you: a room can never be double booked.</li></ul></div>
  <div class="stick"><div class="card pad"><div class="price" style="font:700 1.5rem Georgia">${money(r.price)} <small class="mute" style="font:400 .9rem system-ui">/ night</small></div>
  <div id="cal" style="margin-top:12px"></div><div id="sum"></div>
  <form id="bf"><div class="f"><label class="lbl">Full name</label><input id="n" required maxlength="80" autocomplete="name"></div>
  <div class="f"><label class="lbl">Email</label><input id="e" type="email" required autocomplete="email"></div>
  <div class="f"><label class="lbl">Phone</label><input id="p" type="tel" required placeholder="+237 6XX XXX XXX" autocomplete="tel"></div>
  <div class="f"><label class="lbl">Guests</label><select id="g">${Array.from({ length: r.capacity }, (_, i) => `<option ${(+q.get("guests") || 2) === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>
  <div class="f"><label class="lbl">Special requests (optional)</label><textarea id="no" rows="2" maxlength="500"></textarea></div>
  ${SITE.payments && SITE.payments.provider !== "off" ? `<div class="f"><label class="lbl">Payment</label><label class="opt"><input type="radio" name="pm" value="arrival" checked> Pay on arrival</label><label class="opt"><input type="radio" name="pm" value="momo"> Pay now with mobile money (MTN or Orange)</label></div>` : ""}
  <div class="err" id="err"></div><button class="btn" id="go" style="width:100%" disabled>Select your dates</button></form></div></div></div></div>`;
  bindGallery(r);
  const sum = () => {
    $("#sum").innerHTML = ci && co ? `<div class="sum"><div class="row"><span>${fmt(ci)} → ${fmt(co)}</span></div><div class="row"><span>${nightsBetween(ci, co)} night(s) × ${money(r.price)}</span><span></span></div>
    <div class="row tot"><span>Total</span><span>${money(nightsBetween(ci, co) * r.price)}</span></div></div>` : "";
    $("#go").disabled = !(ci && co); $("#go").textContent = ci && co ? "Confirm booking" : "Select your dates";
  };
  const cal = calendar($("#cal"), booked, (a, b) => { ci = a; co = b; $("#err").textContent = ""; sum(); });
  cal.draw(); sum();
  const qi = q.get("in"), qo = q.get("out");
  if (qi && qo && qo > qi && qi >= TODAY) { let ok = true; for (let d = qi; d < qo; d = addDays(d, 1)) if (booked.includes(d)) ok = false; if (ok) cal.set(qi, qo); }
  $("#bf").onsubmit = async e => {
    e.preventDefault(); const btn = $("#go"); const mail = $("#e").value; btn.disabled = true; btn.textContent = "Booking…"; $("#err").textContent = "";
    try {
      const b = await api("/bookings", { roomId: r.id, checkIn: ci, checkOut: co, guests: $("#g").value, name: $("#n").value, email: $("#e").value, phone: $("#p").value, notes: $("#no").value, payMethod: (document.querySelector("input[name=pm]:checked") || { value: "arrival" }).value });
      b.status === "pending_payment" ? paymentStep(b, mail) : confirmation(b);
    } catch (er) {
      $("#err").textContent = er.message;
      if (er.status === 409) { booked = (await api(`/rooms/${id}/booked`)).booked; cal.update(booked); cal.reset(); }
      sum();
    }
  };
}

const payBadge = b => b.status === "cancelled" ? (b.paymentStatus === "paid" ? `<span class="badge no">paid · refund needed</span>` : "") : b.paymentStatus === "paid" ? `<span class="badge ok">paid</span>` : b.status === "pending_payment" ? `<span class="badge info">awaiting payment</span>` : `<span class="badge info">pay on arrival</span>`;
function confirmation(b) {
  history.replaceState(null, "", "#/booked");
  app.innerHTML = `<div class="wrap"><div class="card pad center"><div style="font-size:3rem">✅</div><h1>Booking confirmed</h1><p class="mute">Thank you, ${esc(b.name.split(" ")[0])}! Your room is reserved. Please keep your reference:</p>
  <div class="ref">${esc(b.ref)}</div>
  <div class="sum" style="text-align:left"><div class="row"><span>Room</span><b>${esc(b.roomName)}</b></div><div class="row"><span>Check-in</span><b>${fmt(b.checkIn)} from ${SITE.checkInTime}</b></div>
  <div class="row"><span>Check-out</span><b>${fmt(b.checkOut)} by ${SITE.checkOutTime}</b></div><div class="row"><span>Guests</span><b>${b.guests}</b></div>
  <div class="row"><span>Payment</span><span>${payBadge(b)}</span></div><div class="row tot"><span>${b.paymentStatus === "paid" ? "Total paid" : "Total to pay on arrival"}</span><span>${money(b.total)}</span></div></div>
  <p class="note">A confirmation was sent to ${esc(b.email)} and by SMS to ${esc(b.phone)}. Use your reference and email to view or cancel the booking. Questions? ${esc(SITE.phone)}</p>
  <div class="bar" style="justify-content:center"><a class="btn" href="#/manage">Manage my booking</a><a class="btn ghost" href="#/rooms">Back to rooms</a></div></div></div>`;
}

async function paymentStep(b, email) {
  history.replaceState(null, "", "#/booked");
  const P = SITE.payments, q = `email=${encodeURIComponent(email)}`;
  app.innerHTML = `<div class="wrap"><div class="card pad center"><div style="font-size:2.6rem">📱</div><h1>Complete your payment</h1>
  <p class="mute">Booking <b>${esc(b.ref)}</b> · ${esc(b.roomName)} · <b>${money(b.total)}</b><br>Your room is held for ${P.holdMinutes} minutes.</p>
  <div id="pb"><p class="mute">Starting your payment…</p></div><div class="err" id="perr"></div><div class="bar" style="justify-content:center"><a class="btn ghost" href="#/manage">I'll pay later</a></div></div></div>`;
  let info;
  try { info = await api(`/bookings/${b.ref}/pay`, { email, phone: b.phone }); }
  catch (e) { $("#perr").textContent = e.message; $("#pb").innerHTML = `<button class="btn" id="rt">Try again</button>`; $("#rt").onclick = () => paymentStep(b, email); return; }
  $("#pb").innerHTML = info.mode === "manual"
    ? `<div class="sum" style="text-align:left"><p style="margin:0 0 6px">Send <b>${money(b.total)}</b> by mobile money to:</p>${P.momoNumber ? `<div class="row"><span>MTN MoMo</span><b>${esc(P.momoNumber)}</b></div>` : ""}${P.orangeNumber ? `<div class="row"><span>Orange Money</span><b>${esc(P.orangeNumber)}</b></div>` : ""}<div class="row"><span>Name</span><b>${esc(P.accountName)}</b></div><div class="row"><span>Reason / message</span><b>${esc(b.ref)}</b></div></div>
       <p class="note">We confirm your booking as soon as we see the payment. You will receive an SMS and email.</p>`
    : `<p>We sent a payment request to <b>${esc(info.phone)}</b>${info.operator ? ` (${esc(info.operator)})` : ""}. Approve it with your mobile money PIN.</p>${info.ussd ? `<p class="note">No prompt? Dial <b>${esc(info.ussd)}</b> to approve.</p>` : ""}`;
  $("#pb").insertAdjacentHTML("beforeend", `<p class="mute" id="ps">⏳ Waiting for payment…</p>`);
  const poll = async () => {
    try {
      const r = await api(`/bookings/${b.ref}/payment?${q}`);
      if (r.paymentStatus === "paid") return confirmation(await api(`/bookings/lookup?ref=${b.ref}&${q}`));
      if (r.status === "cancelled") { $("#pb").innerHTML = `<p class="err">Your reservation expired because payment was not received in time.</p><a class="btn" href="#/rooms">Book again</a>`; return; }
      if (r.paymentStatus === "failed") { $("#ps").innerHTML = `❌ The payment was not completed. <button class="btn" id="rt">Try again</button>`; $("#rt").onclick = () => paymentStep(b, email); return; }
    } catch {}
    pollT = setTimeout(poll, 4000);
  };
  pollT = setTimeout(poll, 3000);
}

function bookingCard(b) {
  const canCancel = b.status !== "cancelled" && b.checkIn >= TODAY, canPay = b.status === "pending_payment" && SITE.payments.provider !== "off";
  return `<div class="card pad" style="margin-top:18px"><div class="chips"><span class="badge ${b.status === "cancelled" ? "no" : b.status === "confirmed" ? "ok" : "info"}">${b.status === "pending_payment" ? "awaiting payment" : b.status}</span>${payBadge(b)}</div><h2>${esc(b.roomName)}</h2>
  <div class="sum"><div class="row"><span>Reference</span><b>${esc(b.ref)}</b></div><div class="row"><span>Guest</span><b>${esc(b.name)}</b></div><div class="row"><span>Check-in</span><b>${fmt(b.checkIn)}</b></div>
  <div class="row"><span>Check-out</span><b>${fmt(b.checkOut)}</b></div><div class="row"><span>Guests</span><b>${b.guests}</b></div><div class="row tot"><span>Total</span><span>${money(b.total)}</span></div></div>
  <div class="bar">${canPay ? `<button class="btn" id="pn">Pay now</button>` : ""}${canCancel ? `<button class="btn danger" id="cx">Cancel this booking</button>` : ""}</div><div class="err" id="cerr"></div></div>`;
}
function manage() {
  app.innerHTML = `<div class="wrap" style="max-width:640px"><h1>Manage my booking</h1><p class="mute">Enter your booking reference and the email you used.</p>
  <form class="card pad" id="mf"><div class="f"><label class="lbl">Booking reference</label><input id="r" placeholder="RG-XXXXXX" required></div>
  <div class="f"><label class="lbl">Email</label><input id="e" type="email" required></div><div class="err" id="err"></div><button class="btn dark">Find my booking</button></form><div id="res"></div></div>`;
  $("#mf").onsubmit = async e => {
    e.preventDefault(); $("#err").textContent = ""; $("#res").innerHTML = "";
    try {
      const em = $("#e").value, b = await api(`/bookings/lookup?ref=${encodeURIComponent($("#r").value)}&email=${encodeURIComponent(em)}`);
      $("#res").innerHTML = bookingCard(b);
      if ($("#pn")) $("#pn").onclick = () => paymentStep(b, em);
      if ($("#cx")) $("#cx").onclick = async () => {
        if (!confirm("Cancel this booking? The dates will be released.")) return;
        try { $("#res").innerHTML = bookingCard(await api("/bookings/cancel", { ref: b.ref, email: em })); } catch (er) { $("#cerr").textContent = er.message; }
      };
    } catch (er) { $("#err").textContent = er.message; }
  };
}

async function adminPage(tab = "bookings") {
  let rows, blocks;
  try { [rows, blocks] = await Promise.all([api("/admin/bookings"), api("/admin/blocks")]); }
  catch (e) {
    if (e.status !== 401 && e.status !== 503) throw e;
    app.innerHTML = `<div class="wrap" style="max-width:420px"><h1>Admin</h1><form class="card pad" id="lf"><div class="f"><label class="lbl">Password</label><input type="password" id="pw" required></div>
    <div class="err" id="err">${e.status === 503 ? esc(e.message) : ""}</div><button class="btn dark">Log in</button></form></div>`;
    $("#lf").onsubmit = async ev => { ev.preventDefault(); try { await api("/admin/login", { password: $("#pw").value }); adminPage(); } catch (er) { $("#err").textContent = er.message; } };
    return;
  }
  const live = rows.filter(b => b.status !== "cancelled" && b.checkOut >= TODAY), now = live.filter(b => b.checkIn <= TODAY && TODAY < b.checkOut);
  const rn = id => (ROOMS.find(r => r.id === id) || { name: id }).name;
  let f = "upcoming";
  const bookingsHtml = () => `<div class="stats"><div class="card"><b>${live.length}</b><span class="mute">Upcoming and current bookings</span></div><div class="card"><b>${now.length}</b><span class="mute">Rooms occupied today</span></div>
    <div class="card"><b>${money(live.reduce((a, b) => a + b.total, 0))}</b><span class="mute">Expected revenue</span></div><div class="card"><b>${money(rows.filter(b => b.paymentStatus === "paid").reduce((a, b) => a + b.total, 0))}</b><span class="mute">Received so far</span></div></div>
    <div class="bar">${[["upcoming", "Upcoming"], ["all", "All"], ["cancelled", "Cancelled"]].map(([k, t]) => `<button class="btn ${k === f ? "dark" : "ghost"}" data-f="${k}">${t}</button>`).join("")}</div>
    <div class="card tw"><table><thead><tr><th>Ref</th><th>Room</th><th>Dates</th><th>Guest</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const drawRows = () => {
    const list = rows.filter(b => f === "all" || (f === "upcoming" ? b.status !== "cancelled" && b.checkOut >= TODAY : b.status === "cancelled")).sort((a, b) => a.checkIn < b.checkIn ? -1 : 1);
    $("#tb").innerHTML = list.map(b => `<tr><td><b>${esc(b.ref)}</b></td><td>${esc(b.roomName)}</td><td>${b.checkIn} → ${b.checkOut}<br><span class="note">${b.nights} night(s)</span></td><td>${esc(b.name)}<br><span class="note">${esc(b.phone)} · ${esc(b.email)}</span></td>
    <td>${money(b.total)}</td><td><span class="badge ${b.status === "cancelled" ? "no" : b.status === "confirmed" ? "ok" : "info"}">${b.status === "pending_payment" ? "awaiting payment" : b.status}</span></td><td>${payBadge(b)}</td>
    <td style="white-space:nowrap">${b.status !== "cancelled" && b.paymentStatus !== "paid" ? `<button class="btn dark" data-p="${b.ref}" data-m="${b.paymentMethod}" style="padding:5px 12px">Mark paid</button> ` : ""}${b.status !== "cancelled" ? `<button class="btn danger" data-c="${b.ref}" style="padding:5px 12px">Cancel</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="8" class="mute">No bookings here yet.</td></tr>`;
    document.querySelectorAll("[data-c]").forEach(b => b.onclick = async () => { if (!confirm("Cancel booking " + b.dataset.c + "? The guest will be notified.")) return; await api(`/admin/bookings/${b.dataset.c}/cancel`, {}); adminPage(tab); });
    document.querySelectorAll("[data-p]").forEach(b => b.onclick = async () => { await api(`/admin/bookings/${b.dataset.p}/paid`, { method: b.dataset.m === "momo" ? "momo" : "cash" }); adminPage(tab); });
    document.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { f = b.dataset.f; document.querySelectorAll("[data-f]").forEach(x => x.className = "btn " + (x === b ? "dark" : "ghost")); drawRows(); });
  };
  const groups = Object.values(blocks.reduce((m, b) => ((m[b.group] = m[b.group] || { ...b, rooms: [], ids: [] }).rooms.push(rn(b.room)), m[b.group].ids.push(b.id), m), {}));
  const blocksHtml = () => `<div class="card pad"><h3>Block dates</h3><p class="mute">Take a room (or the whole house) out of sale for maintenance, cleaning or private use. Blocked nights can't be booked.</p>
    <form id="bkf" class="search" style="grid-template-columns:repeat(4,1fr) auto;box-shadow:none;padding:0;margin-top:10px"><div><label>Room</label><select id="br"><option value="all">All rooms</option>${ROOMS.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select></div>
    <div><label>From</label><input type="date" id="bf" min="${TODAY}" required></div><div><label>Until (check-out day)</label><input type="date" id="bt" min="${addDays(TODAY, 1)}" required></div><div><label>Reason</label><input id="bn" placeholder="Maintenance" maxlength="100"></div><button class="btn dark">Block</button></form>
    <div class="err" id="berr"></div></div>
    <div class="card tw" style="margin-top:16px"><table><thead><tr><th>Rooms</th><th>Dates</th><th>Reason</th><th></th></tr></thead><tbody>${groups.map(g => `<tr><td>${g.rooms.length > 5 ? "All rooms" : esc(g.rooms.join(", "))}</td><td>${g.checkIn} → ${g.checkOut}</td><td>${esc(g.reason)}</td><td><button class="btn danger" data-g="${g.ids.join(",")}" style="padding:5px 12px">Remove</button></td></tr>`).join("") || `<tr><td colspan="4" class="mute">No blocked dates.</td></tr>`}</tbody></table></div>`;
  app.innerHTML = `<div class="wrap"><div class="bar" style="justify-content:space-between"><h1>Staff area</h1><button class="btn ghost" id="lo">Log out</button></div>
  <div class="bar"><button class="btn ${tab === "bookings" ? "dark" : "ghost"}" id="t1">Bookings</button><button class="btn ${tab === "blocks" ? "dark" : "ghost"}" id="t2">Blocked dates</button></div>${tab === "bookings" ? bookingsHtml() : blocksHtml()}</div>`;
  $("#t1").onclick = () => adminPage("bookings"); $("#t2").onclick = () => adminPage("blocks");
  $("#lo").onclick = async () => { await api("/admin/logout", {}); location.hash = "#/"; };
  if (tab === "bookings") drawRows();
  else {
    $("#bkf").onsubmit = async e => {
      e.preventDefault(); $("#berr").innerHTML = "";
      try { await api("/admin/blocks", { room: $("#br").value, checkIn: $("#bf").value, checkOut: $("#bt").value, reason: $("#bn").value }); adminPage("blocks"); }
      catch (er) { $("#berr").innerHTML = esc(er.message) + (er.conflicts ? "<br>" + er.conflicts.map(c => `${esc(c.ref)} (${esc(c.room)}, ${c.checkIn} → ${c.checkOut}, ${esc(c.name)})`).join("<br>") : ""); }
    };
    document.querySelectorAll("[data-g]").forEach(b => b.onclick = async () => { if (!confirm("Remove this block?")) return; for (const id of b.dataset.g.split(",")) await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" }); adminPage("blocks"); });
  }
}
const notFound = () => { app.innerHTML = `<div class="wrap center"><h1>Page not found</h1><a class="btn" href="#/">Go home</a></div>`; };

let pollT = null;
async function route() {
  clearTimeout(pollT);
  const [path, qs] = (location.hash.slice(1) || "/").split("?"), q = new URLSearchParams(qs || ""), p = path.split("/").filter(Boolean);
  document.querySelectorAll(".top nav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#/" + (p[0] === "room" ? "rooms" : p[0] || "")));
  try {
    if (!p.length) home(); else if (p[0] === "rooms") await roomsPage(q); else if (p[0] === "room") await roomPage(p[1], q);
    else if (p[0] === "manage") manage(); else if (p[0] === "booked") location.hash = "#/manage"; else if (p[0] === "admin") await adminPage(); else notFound();
  } catch (e) { app.innerHTML = `<div class="wrap"><p class="err">${esc(e.message)}</p></div>`; }
  scrollTo(0, 0);
}
(async () => {
  try { [SITE, ROOMS] = await Promise.all([api("/site"), api("/rooms")]); } catch { app.innerHTML = `<div class="wrap"><p class="err">Cannot reach the server. Please try again shortly.</p></div>`; return; }
  $("#foot").innerHTML = `<img src="/img/logo-sm.png" alt=""><b>Royal Guesthouse</b><p>${esc(SITE.address)}<br>📞 ${esc(SITE.phone)} · ✉️ <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a></p><p class="note">Check-in ${SITE.checkInTime} · Check-out ${SITE.checkOutTime} · <a href="#/admin">Staff</a></p>`;
  addEventListener("hashchange", route); route();
})();
