# Royal Guesthouse

Website for a fully furnished guesthouse: guests view the rooms, see live availability on a calendar and book online. **Double booking is impossible.**

**Stack:** Node.js + Express · MongoDB (Atlas or local) · plain HTML/CSS/JS frontend (no build step)

## Run it (Windows PowerShell or any shell)
1. `npm install`
2. `copy .env.example .env` (Mac/Linux: `cp .env.example .env`), then set `MONGODB_URI`, `ADMIN_PASSWORD` and `JWT_SECRET`.
   Leave `MONGODB_URI` empty to try it without a database (bookings are lost when the server restarts).
3. `npm start` and open http://localhost:3000

## What guests can do
- Browse rooms and apartments with photos, amenities and prices (FCFA per night).
- Search by dates and guests to see which rooms are free, with the next free date for each room.
- Pick check-in and check-out on a calendar that greys out booked nights, see the total price, and book.
- Receive a booking reference (RG-XXXXXX). With it and their email they can view or cancel the booking (until the day of arrival) at **My booking**.

## How double booking is prevented
- Every booked night is stored as its own record with a **unique (room, date) database index**. Two guests can't hold the same room on the same night, even if they click "Book" at the same instant: the database rejects the second one and the guest sees "already booked".
- The server re-checks everything. The calendar is only a convenience.
- A new booking can start on the day the previous guest checks out (same-day turnover). Cancelling frees the nights again.
- Optional strict rule: set `STRICT_AFTER_LAST=true` and a room can only be booked from the check-out day of its latest booking onwards (no booking into earlier free gaps).

## Admin
Open `/#/admin` (link "Staff" in the footer), log in with `ADMIN_PASSWORD`. See upcoming bookings, rooms occupied today, expected revenue, and cancel bookings.

## Customise
- Rooms, prices, capacity and descriptions: `server/rooms.js`
- Phone, email and address shown on the site: `.env`
- Room photos: replace `public/img/room-<room-id>.svg` with your own images (keep the file names or change the paths in `public/app.js`; real photos as .jpg need the `<img>` paths updated)
- Logo: `public/img/logo.jpg` (hero), `logo-sm.png` (header and footer), `favicon.png` and `apple-touch-icon.png`. Replace them to change the logo.
- Colours: the black-and-gold theme is set by the variables at the top of `public/style.css` (taken from the logo: gold #c6972f, highlight #ecc369, deep gold #a0640e on black)

## Email and SMS confirmations
Guests get an email and an SMS when they book, when payment is received, and if the booking is cancelled or expires. Staff can get a copy (`ADMIN_NOTIFY_EMAIL`, `ADMIN_NOTIFY_PHONE`).
- Email: any SMTP account (Gmail app password, Brevo, Mailgun, your hosting provider). Fill in `SMTP_*` and `MAIL_FROM`.
- SMS: Twilio (`SMS_PROVIDER=twilio` plus `TWILIO_*`). Phone numbers without a country code get `DEFAULT_COUNTRY_CODE` (237).
- With nothing configured, messages are printed in the server console so you can see exactly what would be sent.

## Mobile-money payment
Guests choose **Pay on arrival** or **Pay now with mobile money** when booking. Set `PAYMENT_PROVIDER` in `.env`:
- `off`: pay on arrival only.
- `manual`: the guest is shown your MTN MoMo / Orange Money numbers and their booking reference. When you see the money, open the admin page and press **Mark paid**.
- `campay`: automatic collection. The guest gets a payment prompt on their phone and the booking confirms itself when they approve. Create a CamPay account, put `CAMPAY_USERNAME` and `CAMPAY_PASSWORD` in `.env`, and test with the demo URL before switching `CAMPAY_BASE_URL` to `https://campay.net/api`.
- `mock`: a fake provider for demos. It "succeeds" after 6 seconds (a phone number ending in 13 fails).

While payment is pending, the dates are held for the guest (`PAY_HOLD_MINUTES`). If they don't pay in time the dates are released automatically and the guest is told. If a payment arrives after a booking expired, the admin is alerted so the guest can be refunded or rebooked, and the admin table shows "paid · refund needed".
The CamPay connection follows its public API (token, collect, transaction status) but could not be tested against a live account here, so run a test payment in the CamPay demo environment first.

## Blocking dates (maintenance, cleaning, private use)
In the admin page open **Blocked dates**, choose one room or all rooms, a start date, an end date (the check-out day) and a reason. Blocked nights are unbookable and show as unavailable on the calendar. A block can't overlap an existing booking: the admin sees which bookings are in the way, so they can cancel or move them first. Remove a block to put the nights back on sale.

## Notes
Natural next steps: real photos of the house, a refund button for the "refund needed" case, a payment webhook from CamPay for instant confirmation, and a calendar view for staff.

## Email not working? Run the diagnostic
`node scripts/mail-test.js you@example.com`

It prints which settings it found, whether your network can reach each SMTP port (587, 465, 2525, 25), whether the login works, and then sends a real test email, explaining any error in plain words.
The most common cause is a network or host that blocks SMTP ports. In that case use an HTTPS email API instead: set `MAIL_PROVIDER=brevo` with `BREVO_API_KEY`, or `MAIL_PROVIDER=resend` with `RESEND_API_KEY`, and set `MAIL_FROM` to a sender address you have verified with that provider. Restart the server after changing `.env`.

## Photos and video tour
- The **Royal Apartment** (25,000 FCFA per night) uses your real photos: `public/media/apt-*.jpg` (living room, kitchen, bedroom, bathroom). All six photos can be swiped through: on phones swipe left and right; on computers drag, use the arrows, the dots, the thumbnails or the keyboard arrow keys. The room card in the lists swipes too, and tapping a photo opens a full-screen viewer that swipes as well.
- The two walk-through videos (`public/media/tour1.mp4`, `tour2.mp4`) fill a full-width **Take a tour of the guesthouse** section on the home page, each in a large player with a Full screen button. They are listed in `server/media.js`; add or replace videos there.
- To add photos to another room, put the images in `public/media/` and give the room a `cover` and a `photos` list in `server/rooms.js` (see the Royal Apartment entry). Rooms without photos show a drawing.
