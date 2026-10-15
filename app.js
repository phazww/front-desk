const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const B = window.BUSINESS, KB = window.KB, index = Desk.makeIndex(KB);

const MODELS = [
  { id: "gemma-4-E2B-it-q4f16_1-MLC", label: "Gemma 4 E2B" },
  { id: "Qwen3.5-2B-q4f16_1-MLC", label: "Qwen 3.5 2B" }
];
const SAMPLES = ["How much is a croissant?", "Can I order a birthday cake for tomorrow?", "Is anything nut free?", "Do you have pizza?"];

$("kb").innerHTML = KB.map((e) => `<div class="kb-item" id="kb-${e.id}"><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div>`).join("");
$("model").innerHTML = MODELS.map((m) => `<option value="${m.id}">${esc(m.label)}</option>`).join("");
$("chips").innerHTML = SAMPLES.map((s) => `<button type="button" class="chip-q">${esc(s)}</button>`).join("");

// ---------- the model, loaded on first question ----------
let webllm = null, engine = null, engineId = null;
function status(text, progress) {
  $("engine").textContent = text || "";
  $("bar").style.display = progress == null ? "none" : "block";
  if (progress != null) $("bar").firstElementChild.style.width = Math.round(progress * 100) + "%";
}
async function getEngine(id) {
  if (engine && engineId === id) return engine;
  if (!navigator.gpu) throw new Error("This browser has no WebGPU, so the model cannot run here. Press \"See recorded answers\", or open the page in a recent Chrome, Edge or Safari on a computer.");
  if (!webllm) { status("Loading the runtime…", 0); webllm = await import("https://esm.run/@mlc-ai/web-llm"); }
  if (engine) { try { await engine.unload(); } catch (e) {} engine = null; }
  engine = await webllm.CreateMLCEngine(id, {
    initProgressCallback: (p) => status(p.progress < 1 ? `Getting the model onto your machine, one time only: ${Math.round(p.progress * 100)}%` : "Starting the model…", p.progress)
  });
  engineId = id;
  return engine;
}

// One question in, what the customer sees out. Used by the chat and by the test set.
async function answer(question) {
  const hits = Desk.retrieve(index, question);
  if (!hits.length) return { hits, raw: null, result: { ok: false, reason: "Nothing on the site is about this, so the model was not asked.", text: `I can't find that on our site, and I don't want to guess. Please call us on ${B.phone} or write to ${B.email}.` } };
  const eng = await getEngine($("model").value);
  status("Thinking…");
  const res = await eng.chat.completions.create({
    messages: [{ role: "user", content: Desk.prompt(B, question, hits) }],
    temperature: 0, max_tokens: 300,
    response_format: { type: "json_object", schema: JSON.stringify(Desk.schema(hits)) },
    extra_body: { enable_thinking: false }
  });
  const text = (res.choices[0].message.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  let raw = null;
  try { raw = JSON.parse(text); } catch (e) {}
  status("");
  return { hits, raw, result: Desk.check(raw, hits, B) };
}

function bubble(who, html) {
  const d = document.createElement("div");
  d.className = "msg " + who;
  d.innerHTML = html;
  $("log").appendChild(d);
  $("log").scrollTop = $("log").scrollHeight;
  return d;
}
function show(r) {
  const x = r.result;
  document.querySelectorAll(".kb-item.lit").forEach((el) => el.classList.remove("lit"));
  if (x.entry) {
    const el = $("kb-" + x.entry.id), panel = document.querySelector(".kb");
    if (el) { el.classList.add("lit"); panel.scrollTop = el.offsetTop - panel.offsetTop - 60; }
  }
  if (x.ok) {
    return bubble("bot", `<p>${esc(x.text)}</p>
      <div class="proof ok"><b>✓ Checked</b> against “${esc(x.entry.title)}”: the quote is on the site, every number matches and every word is backed by the site.${x.cut && x.cut.length ? ` Cut from the draft: <q>${esc(x.cut.join(" "))}</q>` : ""}</div>`);
  }
  if (x.entry) {
    return bubble("bot", `<p>I'm not sure about that, and I don't want to guess. The closest part of our site says:</p><blockquote>${esc(x.entry.text)}</blockquote><p>For anything else, call us on ${esc(B.phone)}.</p>
      <div class="proof stepped"><b>Draft thrown away.</b> ${esc(x.reason)}</div>`);
  }
  return bubble("bot", `<p>${esc(x.text)}</p><div class="proof stepped"><b>No answer drafted.</b> ${esc(x.reason)}</div>`);
}

let busy = false;
async function ask(q) {
  q = q.trim();
  if (!q || busy) return;
  busy = true; $("send").disabled = true;
  bubble("me", `<p>${esc(q)}</p>`);
  $("q").value = "";
  try { show(await answer(q)); }
  catch (e) { status(String((e && e.message) || e)); }
  finally { busy = false; $("send").disabled = false; }
}
$("ask").addEventListener("submit", (e) => { e.preventDefault(); ask($("q").value); });
$("chips").addEventListener("click", (e) => { if (e.target.matches(".chip-q")) ask(e.target.textContent); });

// Real answers saved from a test run, so the checks can be seen without downloading a model.
$("recorded").addEventListener("click", () => {
  const rec = window.RECORDED;
  if (!rec) { status("No recorded answers yet."); return; }
  $("log").innerHTML = "";
  bubble("note", `<p>Six real drafts from ${esc(rec.model)}, saved on ${esc(rec.date)}, run through the same checks as a live answer. Nothing was downloaded.</p>`);
  const pick = ["How much is a croissant?", "Can I order a birthday cake for tomorrow?", "Is anything nut free? My son has a nut allergy.",
    "Do you have a loyalty card?", "How many seats do you have inside?", "Do you have pizza?"];
  rec.items.filter((it) => pick.includes(it.q)).forEach((it) => {
    bubble("me", `<p>${esc(it.q)}</p>`);
    const hits = Desk.retrieve(index, it.q);
    const result = it.raw === null && !hits.length
      ? { ok: false, reason: "Nothing on the site is about this, so the model was not asked.", text: `I can't find that on our site, and I don't want to guess. Please call us on ${B.phone} or write to ${B.email}.` }
      : Desk.check(it.raw, hits, B);
    show({ result });
  });
});

if (!navigator.gpu) status("This browser has no WebGPU, so the live model cannot run here. Press \"See recorded answers\" to see real answers and the checks.");

// A link with #recorded opens straight on the recorded answers.
if (location.hash === "#recorded") { $("recorded").click(); document.querySelector(".demo").scrollIntoView(); }

// Test set: open the page with #tests.
if (location.hash === "#tests") {
  const sec = document.createElement("section");
  sec.innerHTML = `<h2>Run the test set</h2><p class="sub">31 questions with known answers, 8 of them not answerable from the site.</p>
    <div class="row"><button id="tests-run">Run with the selected model</button></div><div class="engine" id="tests-status"></div><div id="tests-out"></div>`;
  document.querySelector("main").prepend(sec);
  const s = document.createElement("script");
  s.src = "tests.js";
  document.body.appendChild(s);
  $("tests-run").addEventListener("click", async () => {
    $("tests-run").disabled = true;
    try {
      const rows = await window.runDeskTests(answer, (i, n) => { $("tests-status").textContent = `Question ${i} of ${n}`; });
      window.deskTestRows = rows;
      $("tests-status").textContent = `${rows.filter((r) => r.right).length} of ${rows.length} right`;
      $("tests-out").innerHTML = `<div class="tablewrap"><table><thead><tr><th>Question</th><th>Expected</th><th>Shown</th><th></th></tr></thead><tbody>${rows.map((r) =>
        `<tr><td>${esc(r.q)}</td><td>${esc(r.expected || "say it doesn't know")}</td><td>${esc(r.reason ? "[" + r.reason + "]" : r.shown)}</td><td>${r.right ? "✓" : "✕"}</td></tr>`).join("")}</tbody></table></div>`;
    } catch (e) { $("tests-status").textContent = String((e && e.message) || e); }
    $("tests-run").disabled = false;
  });
}

window.desk = { answer, getEngine };
