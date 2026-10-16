// Front Desk widget: one script tag adds a chat button to any site.
//
//   <script src="https://phazww.github.io/front-desk/widget.js"
//           data-content="https://example.com/front-desk.json" async></script>
//
// data-content  JSON with { business: { name, phone, email }, entries: [{ id, title, text, words }] }
// data-endpoint optional OpenAI-compatible chat completions URL (a proxy that holds the API key).
//               Without it the widget runs in quote mode: it shows the closest part of the
//               site word for word, so nothing can be made up and nothing is paid per question.
// data-model    optional model name sent to the endpoint
// data-color    optional accent colour, for example #b4532a
(function () {
  const me = document.currentScript;
  if (!me) return;
  const base = me.src.replace(/[^/]*$/, "");
  const cfg = {
    content: me.dataset.content,
    endpoint: me.dataset.endpoint || "",
    model: me.dataset.model || "",
    color: me.dataset.color || "#b4532a"
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  function loadDesk() {
    if (window.Desk) return Promise.resolve(window.Desk);
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = base + "desk.js";
      s.onload = () => ok(window.Desk);
      s.onerror = () => fail(new Error("Could not load desk.js"));
      document.head.appendChild(s);
    });
  }

  let data = null, index = null, siteWords = null;
  async function ready() {
    if (data) return;
    const [Desk, res] = await Promise.all([loadDesk(), fetch(cfg.content)]);
    data = await res.json();
    index = Desk.makeIndex(data.entries);
    siteWords = new Set(Desk.tokens(data.entries.map((e) => e.title + " " + e.text + " " + (e.words || "")).join(" ")));
  }

  const contact = () => `Please call us on ${data.business.phone}${data.business.email ? " or write to " + data.business.email : ""}.`;

  // Same path as the demo: find, draft (only with an endpoint), check.
  async function answer(q) {
    await ready();
    const hits = Desk.retrieve(index, q);
    if (!hits.length) return { kind: "none", text: `I can't find that on our site, and I don't want to guess. ${contact()}` };
    if (!cfg.endpoint) {
      // Quote mode shows a part of the site only if it covers at least half of what was asked;
      // "do you sell wedding dresses" should not be answered with the bread prices.
      const asked = [...new Set(Desk.tokens(q))];
      const words = new Set(Desk.tokens(hits[0].entry.title + " " + hits[0].entry.text + " " + (hits[0].entry.words || "")));
      // If half the question is words the site never uses ("croissant" on a site without croissants), the site doesn't cover it.
      if (!asked.length || asked.filter((t) => !siteWords.has(t)).length / asked.length >= 0.5 || asked.filter((t) => words.has(t)).length / asked.length < 0.5) return { kind: "none", text: `I can't find that on our site, and I don't want to guess. ${contact()}` };
      return { kind: "quote", entry: hits[0].entry };
    }
    const res = await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign(cfg.model ? { model: cfg.model } : {}, {
        messages: [{ role: "user", content: Desk.prompt(data.business, q, hits) }],
        temperature: 0,
        response_format: { type: "json_object" }
      }))
    });
    let raw = null;
    try { raw = JSON.parse((await res.json()).choices[0].message.content); } catch (e) {}
    const r = Desk.check(raw, hits, data.business);
    if (r.ok) return { kind: "answer", text: r.text, entry: r.entry };
    return r.entry ? { kind: "quote", entry: r.entry } : { kind: "none", text: r.text };
  }

  // ---------- UI, inside a shadow root so the site's styles do not leak in ----------
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483000";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    .fab { width: 56px; height: 56px; border-radius: 50%; border: 0; cursor: pointer; background: ${cfg.color}; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.2); font-size: 24px; float: right; }
    .panel { display: none; width: 340px; max-width: calc(100vw - 40px); height: 460px; max-height: calc(100vh - 110px); margin-bottom: 12px; background: #fff; color: #222; border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,.22); overflow: hidden; flex-direction: column; }
    .panel.open { display: flex; }
    .head { padding: 14px 16px; background: ${cfg.color}; color: #fff; font-weight: 600; font-size: 15px; display: flex; justify-content: space-between; align-items: center; }
    .head small { display: block; font-weight: 400; opacity: .85; font-size: 12px; }
    .x { background: none; border: 0; color: #fff; font-size: 20px; cursor: pointer; }
    .log { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #faf8f5; }
    .m { max-width: 86%; padding: 9px 12px; border-radius: 14px; font-size: 14px; line-height: 1.4; }
    .me { align-self: flex-end; background: ${cfg.color}; color: #fff; border-bottom-right-radius: 4px; }
    .bot { align-self: flex-start; background: #fff; border: 1px solid #e8e2d8; border-bottom-left-radius: 4px; }
    .bot q { display: block; margin: 6px 0; padding-left: 8px; border-left: 3px solid #e8e2d8; quotes: none; }
    .bot .src { display: block; margin-top: 6px; font-size: 11.5px; color: #2f7a4b; }
    form { display: flex; gap: 6px; padding: 10px; border-top: 1px solid #eee; background: #fff; }
    input { flex: 1; min-width: 0; padding: 9px 11px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
    button.send { padding: 9px 14px; border: 0; border-radius: 8px; background: ${cfg.color}; color: #fff; font-weight: 600; cursor: pointer; }
    .foot { font-size: 11px; color: #888; text-align: center; padding: 0 0 8px; background: #fff; }
  </style>
  <div class="panel" role="dialog" aria-label="Ask us">
    <div class="head"><div><span class="name">Ask us</span><small>Answers come from this site only</small></div><button class="x" aria-label="Close">×</button></div>
    <div class="log" aria-live="polite"></div>
    <form><input placeholder="Ask about hours, prices, orders…" aria-label="Your question"><button class="send" type="submit">Ask</button></form>
    <div class="foot">Front Desk</div>
  </div>
  <button class="fab" aria-label="Open chat">💬</button>`;
  const $ = (s) => root.querySelector(s);
  const log = $(".log");
  function add(cls, html) {
    const d = document.createElement("div");
    d.className = "m " + cls;
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  let greeted = false;
  $(".fab").addEventListener("click", async () => {
    $(".panel").classList.toggle("open");
    if (greeted) return;
    greeted = true;
    try {
      await ready();
      $(".name").textContent = data.business.name;
      add("bot", `Hi! Ask me about ${esc(data.business.name)}. I only answer from this site, and if I'm not sure I'll tell you who to ask.`);
    } catch (e) { add("bot", "Sorry, the assistant could not load."); }
  });
  $(".x").addEventListener("click", () => $(".panel").classList.remove("open"));
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("input").value.trim();
    if (!q) return;
    $("input").value = "";
    add("me", esc(q));
    try {
      const r = await answer(q);
      if (r.kind === "answer") add("bot", `${esc(r.text)}<span class="src">✓ From “${esc(r.entry.title)}” on this site</span>`);
      else if (r.kind === "quote") add("bot", `Here is the closest part of our site:<q>${esc(r.entry.text)}</q>If that doesn't answer it: ${esc(contact())}`);
      else add("bot", esc(r.text));
    } catch (err) { add("bot", "Sorry, something went wrong. " + esc(data ? contact() : "")); }
  });
  (document.body ? Promise.resolve() : new Promise((r) => document.addEventListener("DOMContentLoaded", r))).then(() => document.body.appendChild(host));
})();
