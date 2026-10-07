// 1) Incolla qui i due valori di Supabase (Project Settings > API)
const SUPABASE_URL = "https://snyxizcdjksoqpsskgey.supabase.co";
const SUPABASE_KEY = "sb_publishable_HbmLnlpkW_oT7kOBAw3xeg_WCTlvLlc";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (s) => document.querySelector(s);
const MAX_SIDE = 1600;
const voted = new Set(JSON.parse(localStorage.getItem("voted") || "[]"));
let photos = [], filter = "tutte";

// Frasi a rotazione nel campo lettera
const hints = [
  "Auguri Lollo, sei un coglione.",
  "Madonna che brutto, ma auguri.",
  "Un anno in più e nemmeno un neurone in più.",
  "Scrivi qualcosa di bello. O di brutto, fai tu."
];
$("#body").placeholder = hints[Math.floor(Math.random() * hints.length)];

// Tab
document.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t === b));
  $("#foto").hidden = b.dataset.tab !== "foto";
  $("#lettere").hidden = b.dataset.tab !== "lettere";
});

// Filtri
document.querySelectorAll(".chip").forEach((c) => c.onclick = () => {
  filter = c.dataset.f;
  document.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c));
  renderPhotos();
});

const url = (path) => db.storage.from("photos").getPublicUrl(path).data.publicUrl;
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadPhotos() {
  const { data, error } = await db.from("photos").select("*").order("created_at", { ascending: false });
  if (error) { $("#grid").innerHTML = '<p class="empty">Non riesco a caricare le foto. Controlla le chiavi in app.js.</p>'; return; }
  photos = data;
  renderPhotos();
}

function renderPhotos() {
  let list = photos.slice();
  if (filter === "festa" || filter === "nel-tempo") list = list.filter((p) => p.category === filter);
  if (filter === "classifica") list.sort((a, b) => b.votes - a.votes);
  if (!list.length) { $("#grid").innerHTML = '<p class="empty">Nessuna foto. Madonna che tristezza.</p>'; return; }
  $("#grid").innerHTML = list.map((p, i) => {
    const lead = filter === "classifica" && i === 0 && p.votes > 0;
    const done = voted.has(p.id);
    return `<figure class="card${lead ? " lead" : ""}">
      <img src="${url(p.path)}" loading="lazy" alt="Foto${p.author ? " di " + esc(p.author) : ""}" data-full="${url(p.path)}">
      <div class="row"><span>${lead ? "La favorita" : esc(p.author || "anonimo")}</span>
      <button class="vote" data-id="${p.id}" ${done ? "disabled" : ""}>${done ? "Votata" : "Vota"} ${p.votes}</button></div>
    </figure>`;
  }).join("");
}

$("#grid").onclick = async (e) => {
  if (e.target.matches("img")) { $("#lb img").src = e.target.dataset.full; $("#lb").showModal(); return; }
  const b = e.target.closest(".vote");
  if (!b || b.disabled) return;
  const id = b.dataset.id;
  voted.add(id); localStorage.setItem("voted", JSON.stringify([...voted]));
  const p = photos.find((x) => x.id === id); if (p) p.votes++;
  renderPhotos();
  const { error } = await db.rpc("vote_photo", { photo_id: id });
  if (error) { voted.delete(id); if (p) p.votes--; renderPhotos(); }
};
$("#lbx").onclick = () => $("#lb").close();
$("#lb").onclick = (e) => { if (e.target.id === "lb") $("#lb").close(); };

// Ridimensiona e comprime prima dell'upload
function compress(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b ? res(b) : rej(), "image/jpeg", 0.82);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

$("#upload").onsubmit = async (e) => {
  e.preventDefault();
  const files = [...$("#files").files];
  const msg = $("#upmsg");
  if (!files.length) { msg.textContent = "Scegli almeno una foto."; return; }
  const btn = e.target.querySelector("button"); btn.disabled = true;
  const { category, author } = Object.fromEntries(new FormData(e.target));
  let ok = 0;
  for (const [i, f] of files.entries()) {
    msg.textContent = `Carico ${i + 1} di ${files.length}...`;
    try {
      const blob = await compress(f);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await db.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const ins = await db.from("photos").insert({ path, category, author: author.trim() || null });
      if (ins.error) throw ins.error;
      ok++;
    } catch (err) { console.error(err); }
  }
  msg.textContent = ok === files.length ? `Caricate ${ok} foto.` : `Caricate ${ok} su ${files.length}. Le altre non sono andate, riprova.`;
  $("#files").value = ""; btn.disabled = false;
  loadPhotos();
};

// Lettere
async function loadLetters() {
  const { data, error } = await db.from("letters").select("*").order("created_at", { ascending: false });
  if (error) { $("#letters").innerHTML = '<p class="empty">Non riesco a caricare le lettere.</p>'; return; }
  $("#letters").innerHTML = data.length
    ? data.map((l) => `<article class="letter"><p>${esc(l.body)}</p><small>${esc(l.author || "anonimo")}, ${new Date(l.created_at).toLocaleDateString("it-IT")}</small></article>`).join("")
    : '<p class="empty">Nessuna lettera. Dai, insultalo con affetto.</p>';
}

$("#letterForm").onsubmit = async (e) => {
  e.preventDefault();
  const { author, body } = Object.fromEntries(new FormData(e.target));
  if (!body.trim()) return;
  const btn = e.target.querySelector("button"); btn.disabled = true;
  const { error } = await db.from("letters").insert({ author: author.trim() || null, body: body.trim() });
  btn.disabled = false;
  $("#lmsg").textContent = error ? "Non è partita. Riprova." : "Lettera pubblicata.";
  if (!error) { e.target.reset(); loadLetters(); }
};

loadPhotos();
loadLetters();
