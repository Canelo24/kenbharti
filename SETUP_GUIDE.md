# 📖 Setup Guide — for someone who has never coded

This guide takes you from **zero** to a **working voting & raffle system**.
Follow it top to bottom. Every step is a click or a copy-paste — no coding.

Total time: about **45 minutes**. You need: a laptop with a web browser.

---

## Part 1 — Create your free database (Supabase) · ~15 min

Supabase is the online database that stores votes, tokens and prizes.

1. Go to **https://supabase.com** and click **Start your project**. Sign up
   with your Google account (guptaparth590@gmail.com works fine).
2. Click **New project**.
   - Organization: accept the default.
   - Project name: `kenbharti-voting`
   - Database password: click **Generate a password**, then **copy it into a
     safe note** (you rarely need it again, but keep it).
   - Region: choose **Europe (Frankfurt)** or the closest to Kenya offered.
   - Click **Create new project** and wait ~2 minutes.
3. Create the tables:
   - In the left sidebar click **SQL Editor**, then **New query**.
   - Open the file **`supabase/schema.sql`** from this project on GitHub
     (github.com → your repo → `supabase` folder → `schema.sql` → the
     **Copy raw file** button, two overlapping squares).
   - Paste everything into the SQL editor and press **Run** (bottom right).
   - You should see "Success. No rows returned". Done — all tables,
     security rules, sample entries and prizes now exist.
4. Collect your two secret keys (you'll paste them into Vercel in Part 2):
   - Left sidebar → ⚙️ **Project Settings** → **API**.
   - Copy **Project URL** (looks like `https://abcd1234.supabase.co`).
   - Copy the **service_role** key (click **Reveal** first). ⚠️ This key is
     secret — never send it to anyone, never put it in a WhatsApp group.

---

## Part 2 — Put the website online (Vercel) · ~15 min

Vercel runs the actual website, for free.

1. Go to **https://vercel.com** and sign up — choose **Continue with GitHub**
   and log in with the GitHub account that owns this repository.
2. Click **Add New… → Project**.
3. Find **kenbharti** in the repository list and click **Import**.
   (If asked which branch, use the branch this code is on.)
4. Before clicking Deploy, open **Environment Variables** and add these four
   (Name on the left, Value on the right, click **Add** after each):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL you copied in Part 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key you copied in Part 1 |
   | `ADMIN_PASSWORD` | invent a strong password — this opens your control room |
   | `NEXT_PUBLIC_BASE_URL` | leave blank for now — we fill it in step 6 |

   For `NEXT_PUBLIC_BASE_URL` just type `https://example.com` for now.
5. Click **Deploy** and wait ~2 minutes until you see confetti.
6. Vercel now shows your site address, e.g. `https://kenbharti.vercel.app`.
   - Go to **Settings → Environment Variables**, edit `NEXT_PUBLIC_BASE_URL`
     and set it to that exact address (with `https://`, no trailing slash).
   - Go to the **Deployments** tab → ⋯ menu on the newest one → **Redeploy**.
   - (If you later buy `vote.kenbharti.org`, add it under Settings → Domains
     and update `NEXT_PUBLIC_BASE_URL` again, then Redeploy, and regenerate
     the QR PDF — the QR codes contain the address.)

**Your three important pages are now live:**

| Page | Address | Who uses it |
|---|---|---|
| Control room | `your-site.vercel.app/admin` | you (password) |
| Projector | `your-site.vercel.app/screen` | laptop on HDMI |
| Voter page | printed QR cards only | attendees |

---

## Part 3 — Generate the 850 QR cards · ~10 min

1. Open `your-site.vercel.app/admin` on your phone or laptop and enter your
   admin password.
2. Scroll to the **Tokens** section and press
   **⚙️ Generate 850 tokens (one time)**. Wait ~10 seconds.
3. Press **⬇️ Test page (8 cards)** — a small PDF downloads. **Print that one
   page and scan it with 3 different phones.** All three should open a page
   saying "Welcome, KB-000X".
4. Only when the test scans work: press **⬇️ Full qr-cards.pdf (850 cards)**
   and send it to the printer. Also press **⬇️ tokens.csv** and keep that
   file safe — it is your master list.
5. Cut the cards. Keep them **in number order** — this matters at check-in.

**At check-in on the night:** hand cards out strictly in sequence
(KB-0001, KB-0002, …). Note the last number you gave out. In the admin
**Raffle** section, set the active range to that (e.g. `KB-0001-KB-0650`).
The 50 reserve cards (KB-0801–KB-0850) stay at the help desk with a paper
log; they only work after you press **Activate** next to them in admin.

---

## Part 4 — Add the real entries · ~5 min

In `/admin` → **Entries**:

1. Tap **Rangoli**, rename the sample entries to the real rangoli names
   (or ✕ them and add your own), and use **📷** / **Photo** to upload a photo
   of each rangoli. Photos are compressed automatically.
2. Tap **Dance** and do the same for the dance groups.

You can change entries any time — even on the night — without touching code.

---

## Part 5 — Running the show (the night) 🎭

Open `/admin` on your phone. Open `/screen` on the projector laptop
(press F11 for full screen). Then it's just button presses, in this order:

| When the MC says… | You press in /admin |
|---|---|
| (before start) | Projector: **🏠 Idle** |
| "Rangoli voting is open!" | Rounds → Rangoli → **Open**, then Projector: **🎨 Live counter — Rangoli** |
| "Rangoli voting closes now" | Rounds → Rangoli → **Close** |
| "And the winner is…" | Rounds → Rangoli → **Reveal on screen** |
| "Dance voting is open!" | Rounds → Dance → **Open**, then Projector: **💃 Live counter — Dance** |
| "Dance voting closes" | Rounds → Dance → **Close** |
| "Dance results!" | Rounds → Dance → **Reveal on screen** |
| "Time for the raffle!" | Projector: **🎁 Raffle**, then Raffle → press **🎲 Draw** on each prize, hampers first, flight tickets last |

**Raffle tips:**
- Before the flight tickets, switch the pool to **Voted only** (the MC should
  announce early: "you must vote to be in the flight ticket draw").
- Winner doesn't come up in ~30 seconds? Press **🔁 Redraw**.
- Winner collects prize → press **✅ Mark claimed**. Claimed winners can
  never be drawn again — the system guarantees no repeat winners.
- Nothing on any screen ever changes by itself. Every change is you
  pressing a button. If in doubt, breathe — the data is safe.

**Emergencies:** the red **🛑 CLOSE ALL VOTING NOW** button instantly closes
any open round. The failure playbook is in the build spec — print it.

---

## Part 6 — Dress rehearsal (do this 7 days before!)

1. Print a page of test cards (or use the test page from Part 3).
2. Get ~8 friends with phones on **mobile data** (not WiFi).
3. Run the entire show from Part 5, start to raffle.
4. Whatever confused people — tell your developer (or Claude) NOW.
5. After the rehearsal, wipe the test votes: Supabase → SQL Editor → run:
   ```sql
   delete from draws;
   update prizes set status = 'pending';
   delete from votes;
   update tokens set holder_name = null;
   update settings set value = 'locked' where key in ('rangoli_status','dance_status');
   update settings set value = 'idle' where key = 'screen_mode';
   ```
6. **Then stop changing things.** Code freeze. Entries/prizes/ranges can
   still be edited in admin — that's allowed.

---

## Quick answers

- **I forgot the admin password** → Vercel → Settings → Environment
  Variables → edit `ADMIN_PASSWORD` → Redeploy.
- **A guest lost their card** → Tokens section: search the old code, press
  **Void**. Give them a reserve card and press **Activate** on it.
- **Can someone vote twice?** No. The database physically refuses a second
  vote from the same card in the same round, even from two phones at once.
- **The projector laptop died** → `/screen` is just a web page. Open it on
  any other laptop or phone and plug that into the HDMI.
- **Internet dropped mid-vote** → votes already cast are safe in the
  database. Wait, extend the window, carry on.
