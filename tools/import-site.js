#!/usr/bin/env node
// Turns a small business website into the content file the widget reads.
//
//   node tools/import-site.js https://example-cafe.com > front-desk.json
//
// It fetches the home page and up to MAX_PAGES pages it links to on the same site,
// keeps headings, paragraphs and list items, and cuts the text into entries at the
// headings. Phone and email are taken from tel: and mailto: links when there are any.
// The result is a draft: read it, fix titles, drop what customers never ask about.
const MAX_PAGES = Number(process.env.MAX_PAGES || 12);
const MAX_ENTRY = 600; // characters; longer sections are split at sentence ends

const start = new URL(process.argv[2] || "");
const SKIP = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mov|docx?|xlsx?)(\?|$)|\/(wp-json|feed|cart|checkout|my-account|login|wp-admin)\b|#/i;

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'")
  .replace(/&#8211;|&ndash;/g, "-").replace(/&#8212;|&mdash;/g, "-").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
const clean = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": "front-desk-import/0.1 (+https://phazww.github.io/front-desk/)" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok || !/text\/html/.test(res.headers.get("content-type") || "")) return null;
  return { url: res.url, html: await res.text() };
}

// Blocks in page order: { kind: "h" | "p", text }. Scripts, styles, nav, header and footer are dropped.
function blocks(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)\b[\s\S]*?<\/\1>/gi, " ");
  const out = [];
  const re = /<(h[1-4]|p|li|td|dt|dd|address)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(body))) {
    const text = clean(m[2]);
    if (text.length < 3) continue;
    out.push({ kind: /^h/i.test(m[1]) ? "h" : "p", text });
  }
  return out;
}

function links(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      u.hash = "";
      if (u.hostname.replace(/^www\./, "") === start.hostname.replace(/^www\./, "") && !SKIP.test(u.href)) out.add(u.href);
    } catch (e) {}
  }
  return [...out];
}

function contacts(html) {
  const tel = (html.match(/href=["']tel:([^"']+)["']/i) || [])[1];
  const mail = (html.match(/href=["']mailto:([^"'?]+)/i) || [])[1];
  // Many small sites write the number as plain text; take the first North American-looking one.
  const text = clean(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " "));
  const plain = (text.match(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/) || [])[0];
  return { phone: tel ? decodeURIComponent(tel).trim() : (plain || "").trim(), email: mail ? decodeURIComponent(mail).trim() : "" };
}

// Social feed posts embedded in the page (hashtags, emoji) are not site content.
const isFeedNoise = (t) => (t.match(/#\w/g) || []).length >= 2 || (t.match(/\p{Extended_Pictographic}/gu) || []).length >= 3;

// Search hints, so "where are you located" finds the entry with the street address.
// Each rule adds the words customers use for a kind of fact the entry contains.
const HINTS = [
  [/\b\d{2,5}\s+[A-Z][\w.]*(\s+[A-Z][\w.]*)*\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Hwy|Way|Pkwy)\b/, "address location located where find directions visit"],
  [/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b.*\d|\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\bhours\b|\bopen daily\b/i, "hours open opening close closed closing when time today weekend"],
  [/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|@[\w-]+\.[a-z]{2,}/i, "phone call number contact email reach"],
  [/\$\s?\d/, "price prices cost costs much"],
  [/\b(gluten|vegan|vegetarian|dairy|nut|allerg)/i, "allergy allergies allergen gluten free vegan vegetarian dairy nut diet dietary"],
  [/\b(cake|cakes|custom order|pre-?order|catering|wedding)\b/i, "order ordering cake cakes custom birthday wedding catering party advance"],
  [/\b(deliver|delivery|pickup|pick up|take ?out|doordash|uber ?eats|grubhub)\b/i, "delivery deliver pickup takeout order online"],
  [/\b(parking|park)\b/i, "parking park car"],
  [/\b(reservation|reserve|book|table)\b/i, "reservation reserve book booking table"]
];
const hintsFor = (text) => HINTS.filter(([re]) => re.test(text)).map(([, w]) => w).join(" ");

function splitLong(text) {
  if (text.length <= MAX_ENTRY) return [text];
  const parts = [], sentences = text.split(/(?<=[.!?])\s+/);
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + " " + s).length > MAX_ENTRY) { parts.push(cur); cur = s; } else cur = cur ? cur + " " + s : s;
  }
  if (cur) parts.push(cur);
  return parts;
}

(async () => {
  const seen = new Set(), queue = [start.href], pages = [];
  while (queue.length && pages.length < MAX_PAGES) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    let page = null;
    try { page = await get(url); } catch (e) {}
    if (!page) continue;
    pages.push(page);
    for (const l of links(page.html, page.url)) if (!seen.has(l)) queue.push(l);
    await new Promise((r) => setTimeout(r, 500)); // one request at a time, with a pause
  }
  if (!pages.length) { console.error("Could not load " + start.href); process.exit(1); }

  const title = clean((pages[0].html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || start.hostname);
  const name = title.split(/\s[|\-–—:]\s/)[0].trim();
  const contact = pages.map((p) => contacts(p.html)).reduce((a, c) => ({ phone: a.phone || c.phone, email: a.email || c.email }), { phone: "", email: "" });

  // Cut each page into sections at headings; text repeated on many pages (menus, banners) is kept once.
  const seenText = new Set(), entries = [];
  for (const p of pages) {
    const pageTitle = clean((p.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").split(/\s[|\-–—:]\s/)[0].trim();
    let head = pageTitle || "Page", buf = [];
    const flush = () => {
      const text = buf.join(" ").replace(/\s+/g, " ").trim();
      buf = [];
      if (text.length < 25) return;
      splitLong(text).forEach((t, i) => {
        if (seenText.has(t)) return;
        seenText.add(t);
        entries.push({ id: (head + (i ? "-" + (i + 1) : "")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "entry-" + entries.length, title: head, text: t, words: hintsFor(head + " " + t), source: p.url });
      });
    };
    for (const b of blocks(p.html)) {
      if (b.kind === "h") { flush(); head = b.text.slice(0, 80); }
      else if (!seenText.has(b.text) && !isFeedNoise(b.text)) buf.push(/[.!?:]$/.test(b.text) ? b.text : b.text + ".");
    }
    flush();
  }
  // Ids must be unique for the checks.
  const used = new Map();
  for (const e of entries) { const n = used.get(e.id) || 0; used.set(e.id, n + 1); if (n) e.id += "-" + (n + 1); }

  process.stdout.write(JSON.stringify({ business: { name, phone: contact.phone, email: contact.email }, entries, pages: pages.map((p) => p.url) }, null, 1) + "\n");
  console.error(`${pages.length} pages, ${entries.length} entries, phone: ${contact.phone || "none found"}, email: ${contact.email || "none found"}`);
})();
