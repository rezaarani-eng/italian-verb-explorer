const state = {
  data: null,
  selected: null,
  query: "",
  activeTab: "presente"
};

const targetTabs = [
  {
    id: "presente",
    label: "Presente",
    description: "Present-tense indicative examples.",
    match: form => isMood(form, "indicativo") && isTense(form, "presente")
  },
  {
    id: "futuro-semplice",
    label: "Futuro semplice",
    description: "Simple future examples.",
    match: form => isMood(form, "indicativo") && isTense(form, "futuro semplice")
  },
  {
    id: "futuro-anteriore",
    label: "Futuro anteriore",
    description: "Future perfect examples, once they exist in your sheet.",
    match: form => isTense(form, "futuro anteriore")
  },
  {
    id: "congiuntivo",
    label: "Congiuntivo",
    description: "Subjunctive examples for doubt, hope, judgment, and dependent clauses.",
    match: form => normalize(form.mood).includes("congiuntivo") || normalize(form.tense).includes("congiuntivo")
  }
];

const els = {
  input: document.querySelector("#verbSearch"),
  form: document.querySelector("#searchForm"),
  chips: document.querySelector("#suggestionChips"),
  matchList: document.querySelector("#matchList"),
  panel: document.querySelector("#verb-panel"),
  verbCount: document.querySelector("#verbCount"),
  generatedAt: document.querySelector("#generatedAt")
};

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isMood(form, mood) {
  return normalize(form.mood) === normalize(mood);
}

function isTense(form, tense) {
  return normalize(form.tense) === normalize(tense);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function formTextBlob(form) {
  return `${form.person || ""} ${form.focus || ""} ${form.italian || ""} ${form.english || ""}`;
}

function scoreVerb(verb, query) {
  const q = normalize(query);
  if (!q) return 1;

  const lemma = normalize(verb.lemma);
  const meaning = normalize(verb.meaning);
  const title = normalize(verb.title);
  const forms = normalize((verb.forms || []).map(formTextBlob).join(" "));

  if (lemma === q) return 100;
  if (lemma.startsWith(q)) return 92;
  if (lemma.includes(q)) return 76;
  if (title.includes(q)) return 64;
  if (meaning.includes(q)) return 48;
  if (forms.includes(q)) return 28;
  return 0;
}

function getMatches(query) {
  const verbs = state.data?.verbs || [];
  const ranked = verbs
    .map(verb => ({ verb, score: scoreVerb(verb, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.verb.index - b.verb.index)
    .map(item => item.verb);

  return ranked.length ? ranked : verbs.slice(0, 18);
}

function renderChips() {
  const preferred = ["abbracciare", "prevedere", "ricorrere", "mentire", "sposarsi", "farcela"];
  const verbs = preferred
    .map(name => state.data.verbs.find(v => normalize(v.lemma) === normalize(name)))
    .filter(Boolean);

  els.chips.innerHTML = verbs.map(verb => `
    <button type="button" data-lemma="${escapeHtml(verb.lemma)}">${escapeHtml(verb.lemma)}</button>
  `).join("");

  els.chips.addEventListener("click", event => {
    const button = event.target.closest("button[data-lemma]");
    if (!button) return;
    chooseVerb(button.dataset.lemma, true);
  });
}

function renderMatchList() {
  const matches = getMatches(state.query).slice(0, 30);
  els.matchList.innerHTML = matches.map(verb => `
    <button class="match-item ${state.selected?.lemma === verb.lemma ? "active" : ""}" type="button" data-lemma="${escapeHtml(verb.lemma)}">
      <strong>${escapeHtml(verb.lemma)}</strong>
      <small>${escapeHtml(verb.meaning || "Meaning not provided")}</small>
    </button>
  `).join("");

  els.matchList.querySelectorAll("button[data-lemma]").forEach(button => {
    button.addEventListener("click", () => chooseVerb(button.dataset.lemma, true));
  });
}

function splitForms(verb) {
  const used = new Set();
  const groups = targetTabs.map(tab => {
    const forms = (verb.forms || []).filter(form => tab.match(form));
    forms.forEach(form => used.add(form));
    return { ...tab, forms };
  });

  const extra = new Map();
  (verb.forms || []).forEach(form => {
    if (used.has(form)) return;
    const key = form.tense || form.mood || "Other forms";
    if (!extra.has(key)) extra.set(key, []);
    extra.get(key).push(form);
  });

  return { groups, extra: [...extra.entries()].map(([label, forms]) => ({ label, forms })) };
}

function renderTabs(groups) {
  return `
    <div class="tense-tabs" role="tablist" aria-label="Tense shortcuts">
      ${groups.map(group => `
        <button class="tab-button ${state.activeTab === group.id ? "active" : ""} ${group.forms.length ? "" : "missing"}"
          type="button"
          data-target="section-${group.id}"
          data-tab="${group.id}">
          ${escapeHtml(group.label)}
          <span>${group.forms.length ? `${group.forms.length} cards` : "no data yet"}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderFormCard(form) {
  return `
    <article class="form-card">
      <div class="form-top">
        <span class="person">${escapeHtml(form.person || "—")}</span>
      </div>
      <strong class="focus">${escapeHtml(form.focus || form.person || "—")}</strong>
      <p class="italian">${escapeHtml(form.italian || "No Italian example provided.")}</p>
      <p class="english">${escapeHtml(form.english || "No English translation provided.")}</p>
    </article>
  `;
}

function renderSection(group) {
  const cards = group.forms.length
    ? `<div class="forms-grid">${group.forms.map(renderFormCard).join("")}</div>`
    : `<div class="missing-box"><strong>${escapeHtml(group.label)} is ready, but your current sheet does not contain this tense yet.</strong><br>Add rows for ${escapeHtml(group.label)} in the Google Sheet, rerun the GitHub Action, and this section will fill automatically.</div>`;

  return `
    <section class="tense-section" id="section-${group.id}">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(group.label)}</h3>
          <p>${escapeHtml(group.description)}</p>
        </div>
        <span class="count-badge">${group.forms.length} cards</span>
      </div>
      ${cards}
    </section>
  `;
}

function renderExtraSection(extraGroup, index) {
  return `
    <section class="tense-section extra-wrap" id="extra-${index}">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(extraGroup.label)}</h3>
          <p>Extra forms from the current sheet.</p>
        </div>
        <span class="count-badge">${extraGroup.forms.length} cards</span>
      </div>
      <div class="forms-grid">${extraGroup.forms.map(renderFormCard).join("")}</div>
    </section>
  `;
}

function copyVerb(verb) {
  const lines = [`${verb.lemma} — ${verb.meaning || ""}`.trim(), ""];
  for (const form of verb.forms || []) {
    lines.push(`${form.tense} | ${form.person} | ${form.focus || ""}`);
    lines.push(`IT: ${form.italian || ""}`);
    lines.push(`EN: ${form.english || ""}`);
    lines.push("");
  }
  navigator.clipboard?.writeText(lines.join("\n"));
}

function renderVerb(verb) {
  if (!verb) {
    els.panel.innerHTML = `
      <div class="empty-panel">
        <div>
          <strong>No verb selected</strong>
          <p>Search or choose a verb from the index.</p>
        </div>
      </div>
    `;
    return;
  }

  const { groups, extra } = splitForms(verb);
  const totalCards = (verb.forms || []).length;

  els.panel.innerHTML = `
    <article class="verb-header">
      <div>
        <p class="kicker">Selected verb</p>
        <h2>${escapeHtml(verb.lemma)}</h2>
        <p class="meaning">${escapeHtml(verb.meaning || "Meaning not provided")}</p>
        ${verb.note ? `<p class="note">${escapeHtml(verb.note)}</p>` : ""}
      </div>
      <div class="verb-meta">
        <span class="meta-pill">${totalCards} cards</span>
        <span class="meta-pill">${groups.filter(g => g.forms.length).length}/4 tabs filled</span>
        <button class="copy-button" type="button" id="copyVerb">Copy all</button>
      </div>
    </article>
    ${renderTabs(groups)}
    ${groups.map(renderSection).join("")}
    ${extra.map(renderExtraSection).join("")}
  `;

  document.querySelector("#copyVerb")?.addEventListener("click", () => copyVerb(verb));
  document.querySelectorAll(".tab-button[data-target]").forEach(button => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      document.querySelectorAll(".tab-button").forEach(tab => tab.classList.toggle("active", tab === button));
      document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function chooseVerb(query, scroll = false) {
  const matches = getMatches(query);
  const exact = state.data.verbs.find(verb => normalize(verb.lemma) === normalize(query));
  const selected = exact || matches[0] || state.data.verbs[0];

  state.query = query;
  state.selected = selected;
  els.input.value = selected?.lemma || query;

  renderMatchList();
  renderVerb(selected);

  const url = new URL(window.location.href);
  if (selected?.lemma) url.searchParams.set("verb", selected.lemma);
  window.history.replaceState({}, "", url);

  if (scroll) {
    document.querySelector("#explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function init() {
  try {
    els.panel.innerHTML = `<div class="empty-panel"><div><strong>Loading verbs…</strong><p>Preparing your conjugation cards.</p></div></div>`;
    const response = await fetch("data/verbs.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load verbs.json (${response.status})`);
    state.data = await response.json();

    els.verbCount.textContent = state.data.verbs.length;
    if (state.data.generatedAt) {
      const date = new Date(state.data.generatedAt);
      els.generatedAt.textContent = Number.isNaN(date.getTime()) ? "" : `Updated ${date.toLocaleDateString()}`;
    }

    renderChips();

    const params = new URLSearchParams(window.location.search);
    const startingVerb = params.get("verb") || "abbracciare";
    chooseVerb(startingVerb, false);

    els.input.addEventListener("input", event => {
      state.query = event.target.value;
      renderMatchList();
    });

    els.form.addEventListener("submit", event => {
      event.preventDefault();
      chooseVerb(els.input.value, true);
    });
  } catch (error) {
    els.panel.innerHTML = `
      <div class="empty-panel">
        <div>
          <strong>Could not load the verb data</strong>
          <p>${escapeHtml(error.message)}</p>
        </div>
      </div>
    `;
  }
}

init();
