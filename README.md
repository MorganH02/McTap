# MC Tap

Website for MC Tap, a tavern at 303 Pacific Street, Monroe Center, Illinois.

Plain HTML, CSS and JavaScript. No build step, no framework, no dependencies. Open `index.html` in a browser and it works.

## Structure

```
index.html                  the main page
order.html                  online ordering
images/                     photos and favicon (lowercase — see Photos below)
assets/css/styles.css       shared styling
assets/css/order.css        ordering page styling
assets/js/hours.js          hours table + the open/closed badge
assets/js/menu.js           menu items, prices, options, settings
assets/js/order.js          cart and ordering logic
.github/workflows/pages.yml auto-deploy to GitHub Pages
robots.txt, sitemap.xml     so search engines index it
```

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening the file directly with `file://` mostly works, but a local server matches what visitors will see.

## Put it on GitHub Pages

1. Create a new repository on GitHub.
2. Push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Wait for the Actions run to finish. The URL appears on that Settings → Pages screen.

Every push to `main` redeploys automatically.

### Custom domain

Buy a domain, then in **Settings → Pages → Custom domain** enter it and follow the DNS instructions GitHub gives you. Tick **Enforce HTTPS** once the certificate is issued. GitHub will add a `CNAME` file to the repo; leave it alone.

## Before it goes live

Search the project for `example.com` and replace every instance with the real domain. It appears in:

- `index.html` — the `og:` meta tags, `canonical`, and the JSON-LD block
- `robots.txt`
- `sitemap.xml`

Also:

- **Facebook link.** `index.html` has a `TODO` comment above the theme-nights button. Paste the real page URL there.
- **Menu and prices.** The items in the menu board are reconstructed from reviews and photos. Get the real menu from the owner and correct it. Prices were left out on purpose — they change, and a wrong price on a website is worse than no price.
- **Hours.** They live in one place: the `HOURS` array at the top of `assets/js/hours.js`. The same hours are also written into the JSON-LD in `index.html`, so change both. If they ever change permanently, that's the only edit needed.

## The open/closed badge

`assets/js/hours.js` works out whether the bar is open right now in `America/Chicago`, regardless of the visitor's own time zone, and handles closing times after midnight. If JavaScript is off, the badge stays on its neutral state and nothing else breaks.

## Structured data

`index.html` contains a JSON-LD `BarOrPub` block with the address, phone, hours and a few amenities. This is what feeds the Google panel on the right side of search results. After the site is live, run the URL through Google's Rich Results Test and submit it in Google Search Console.

Worth doing separately: claim the Google Business Profile for MC Tap. A verified profile plus this markup does more for a small bar's visibility than almost anything else on the site.

## Photos

All photos live in `images/` at the root of the repo. **The folder name is
lowercase and the code expects it that way.** GitHub Pages runs on Linux, which
treats `Images/` and `images/` as different folders, while macOS and Windows do
not — so a capitalisation slip works fine on your laptop and then 404s once it's
deployed. Same goes for the filenames.

Photos are resized and compressed for the web (roughly 900–1600px wide). Originals should be kept somewhere else; don't commit full-size camera files to the repo.

If photos are swapped out, keep the `width` and `height` attributes on the `<img>` tags accurate. They stop the page from jumping around while images load.

## Ideas not built yet

- Online ordering. The direction depends on what point-of-sale system runs on the bar's tablet. If it's Square, Toast or Clover, their own online ordering feeds the existing system and is the better route. A custom order form only makes sense if there's nothing to plug into.
- A specials or events board pulled from Facebook.
- A page for private parties and large groups.

---

## Online ordering

`order.html` is a working pickup-ordering front end. It has a menu, an item
customizer with substitutions, a cart, a pickup-time picker and a confirmation
screen. **No payment is taken online** — the customer pays at the bar. That
keeps Stripe, PCI compliance, refunds and chargebacks entirely out of it.

### The only file you edit

`assets/js/menu.js`. Items, descriptions, prices and every substitution option
live there, with instructions at the top. It also holds a `MCTAP_CONFIG` block:

| Setting | What it does |
| --- | --- |
| `pricesConfirmed` | While `false`, a yellow warning strip shows on the page. Set `true` once real prices are in. |
| `orderingPaused` | Set `true` to stop taking orders. Menu still shows; the button switches off. |
| `prepMinutes` | How long the kitchen needs. Sets the earliest pickup slot. |
| `lastOrderBeforeCloseMinutes` | Cuts off online orders this long before closing. |
| `taxRate` | **Verify this with whoever does the books.** The placeholder is a guess. |
| `endpoint` | Where orders go. See below. |

### Where orders go

**Privacy first.** Everything in `menu.js` is public — it ships to the browser
as plain text and anyone can read it with View Source. Never put a personal
phone number or private email address in there.

**Default, no server needed.** With `endpoint`, `orderTextTo` and `orderEmailTo`
all null, the page builds a finished ticket and offers "copy order" and "call it
in" using the bar's published number. Nothing personal is exposed.

Set `orderTextTo` or `orderEmailTo` to add a send button — but only with a
contact the bar is happy to publish. A free Google Voice number is the usual
answer: it receives texts, forwards to whoever is working, and can be reassigned
later without touching the website. The bar's landline will not work; landlines
can't receive texts.

**With a server.** Set `endpoint` to a URL and the order is POSTed there as
JSON instead. Reasonable options:

- A Formspree or Basin form endpoint — emails the order, free tier is fine for this volume.
- A Zapier or Make webhook — can text the bartender, email a copy, and log to a spreadsheet at once.
- A Cloudflare Worker or Netlify Function calling Twilio directly. Cheapest at volume, most setup.
- The POS itself, if it accepts orders over an API.

The JSON shape is:

```json
{
  "placedAt": "2026-01-01T18:22:00.000Z",
  "name": "Jane", "phone": "815-555-0100",
  "pickup": "6:45pm", "note": "paying cash",
  "items": [{ "name": "Cheeseburger", "qty": 1, "each": 12.5,
              "options": [{"label":"Double","price":3.5}], "note": "no onion" }],
  "subtotal": 12.5, "tax": 1.09, "total": 13.59
}
```

### Before turning it on

1. **Check the POS first.** If the bar runs Square, Toast or Clover, that system
   already has online ordering that feeds the kitchen directly. Use theirs. This
   page is the right answer only when there's nothing to plug into.
2. **Decide how the bar finds out.** A tablet nobody is watching means missed
   orders, and a missed order is worse than no online ordering. A text to the
   bartender's phone beats a screen across the room.
3. **Real prices and real tax.** Both are placeholders.
4. **Run a few test orders** at different times of day. The page refuses orders
   when the bar is closed and near closing time, so test those cases too.

### Known limits

- The cart clears on refresh, by design.
- `orderingPaused` needs a file edit and a redeploy. A genuine one-tap pause
  needs somewhere to store the flag — the smallest version is a JSON file in
  this repo edited from the GitHub app, which takes about a minute to go live.
- There is nothing stopping a prank order. At this volume a phone number in
  every order is usually enough. If it becomes a problem, the fix is confirming
  the number by text before the kitchen sees the ticket.
