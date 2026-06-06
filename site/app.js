const state = {
  data: null,
  selected: null,
  matches: []
};

const tenseOrder = [
  "Presente",
  "Futuro semplice",
  "Condizionale semplice",
  "Congiuntivo presente"
];

const els = {
  input: document.querySelector("#verbSearch"),
  form: document.querySelector("#searchForm"),
  chips: document.querySelector("#suggestionChips"),
  matchList: document.querySelector("#matchList"),
  verbPanel: document.querySelector("#verbPanel"),
  verbCount: document.querySelector("#verbCount"),
  generatedAt: document.querySelector("#generatedAt")
};

function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function highlight(text, query) {
  const cleanQuery = normalize(query);
  if (!cleanQuery) return escapeHtml(text);

  const words = cleanQuery.split(/\s+/).filter(Boolean);
  let safe = escapeHtml(text);
  for (const word of words) {
    if (word.length < 3) continue;
    const pattern = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    safe = safe.replace(pattern, `<span class="mark">$1</span>`);
  }
  return safe;
}

function scoreVerb(verb, query) {
  const q = normalize(query);
  if (!q) return 1;

  const lemma = normalize(verb.lemma);
  const title = normalize(verb.title);
  const meaning = normalize(verb.meaning);
  const formBlob = normalize(verb.forms.map(f => `${f.focus || ""} ${f.italian} ${f.english}`).join(" "));

  if (lemma === q) return 100;
  if (lemma.startsWith(q)) return 85;
  if (title.includes(q)) return 70;
  if (meaning.includes(q)) return 48;
  if (formBlob.includes(q)) return 30;
  return 0;
}

function findMatches(query) {
  const matches = state.data.verbs
    .map(verb => ({ verb, score: scoreVerb(verb, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.verb.index - b.verb.index)
    .map(item => item.verb);

  return matches.length ? matches : state.data.verbs.slice(0, 12);
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
    els.input.value = button.dataset.lemma;
    selectByQuery(button.dataset.lemma);
  }, { once: false });
}

function renderMatchList(query = "") {
  state.matches = findMatches(query).slice(0, 16);
  els.matchList.innerHTML = state.matches.map(verb => `
    <button class="match-item ${state.selected && state.selected.lemma === verb.lemma ? "active" : ""}"
      type="button"
      data-lemma="${escapeHtml(verb.lemma)}">
      <strong>${escapeHtml(verb.lemma)}</strong>
      <small>${escapeHtml(verb.meaning || "No meaning provided")}</small>
    </button>
  `).join("");

  els.matchList.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      els.input.value = button.dataset.lemma;
      selectByQuery(button.dataset.lemma);
    });
  });
}

function groupForms(verb) {
  const groups = new Map();
  for (const tense of tenseOrder) groups.set(tense, []);
  for (const form of verb.forms) {
    if (!groups.has(form.tense)) groups.set(form.tense, []);
    groups.get(form.tense).push(form);
  }
  return groups;
}

function copyVerb(verb) {
  const lines = [
    `${verb.lemma} — ${verb.meaning}`,
    "",
    ...tenseOrder.flatMap(tense => {
      const forms = verb.forms.filter(form => form.tense === tense);
      return [
        tense,
        ...forms.map(form => `${form.person}: ${form.focus ? form.focus + " — " : ""}${form.italian} — ${form.english}`),
        ""
      ];
    })
  ];
  navigator.clipboard.writeText(lines.join("\n"));
}

function renderVerb(verb, query = "") {
  state.selected = verb;
  const groups = groupForms(verb);
  const note = verb.note ? `<p class="note">${escapeHtml(verb.note)}</p>` : "";

  const sections = [...groups.entries()].map(([tense, forms]) => `
    <section class="tense-section">
      <div class="tense-heading">
        <h3>${escapeHtml(tense)}</h3>
        <small>${forms.length} people</small>
      </div>
      <div class="card-grid">
        ${forms.map(form => `
          <article class="form-card">
            <div class="card-topline">
              <span class="person">${escapeHtml(form.person)}</span>
              <span class="mood">${escapeHtml(form.mood)}</span>
            </div>
            <p class="focus-form">${highlight(form.focus || "—", query)}</p>
            <p class="italian">${highlight(form.italian, query)}</p>
            <p class="english">${highlight(form.english, query)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");

  els.verbPanel.innerHTML = `
    <div class="verb-title-row">
      <div>
        <p class="eyebrow">Selected verb</p>
        <h2>${highlight(verb.lemma, query)}</h2>
        <p class="meaning">${escapeHtml(verb.meaning)}</p>
        ${note}
      </div>
      <button class="copy-button" type="button" id="copyVerb">Copy all 24</button>
    </div>

    <div class="meta-row">
      <span class="pill">#${verb.index}</span>
      <span class="pill">${verb.forms.length} total cards</span>
      <span class="pill">Conjugated form highlighted</span>
      <span class="pill">Italian + English</span>
      <span class="pill">Mobile friendly</span>
    </div>

    <div class="tense-stack">
      ${sections}
    </div>
  `;

  document.querySelector("#copyVerb").addEventListener("click", () => copyVerb(verb));
  renderMatchList(query);
}

function renderEmpty(query) {
  els.verbPanel.innerHTML = `
    <div class="empty-state">
      <div>
        <strong>No exact match yet.</strong>
        <p>Choose a verb from the left, or try a broader search such as “hug”, “predict”, or “lie”.</p>
      </div>
    </div>
  `;
  renderMatchList(query);
}

function selectByQuery(query) {
  const matches = findMatches(query);
  const exact = matches.find(verb => normalize(verb.lemma) === normalize(query));
  const choice = exact || matches[0];

  if (choice) renderVerb(choice, query);
  else renderEmpty(query);
}

async function init() {
  try {
    const response = await fetch("data/verbs.json", { cache: "no-cache" });
    state.data = await response.json();

    els.verbCount.textContent = state.data.verbs.length;
    els.generatedAt.textContent = state.data.generatedAt
      ? `Data generated: ${new Date(state.data.generatedAt).toLocaleString()}`
      : "";

    renderChips();
    const defaultVerb = state.data.verbs.find(v => normalize(v.lemma) === "abbracciare") || state.data.verbs[0];
    els.input.value = defaultVerb.lemma;
    renderVerb(defaultVerb, defaultVerb.lemma);

    els.form.addEventListener("submit", event => {
      event.preventDefault();
      selectByQuery(els.input.value);
    });

    els.input.addEventListener("input", () => {
      const query = els.input.value;
      renderMatchList(query);
      if (normalize(query).length >= 3) {
        const exact = state.data.verbs.find(v => normalize(v.lemma) === normalize(query));
        if (exact) renderVerb(exact, query);
      }
    });
  } catch (error) {
    console.error(error);
    els.verbPanel.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>Could not load verb data.</strong>
          <p>Check that <code>site/data/verbs.json</code> exists and is valid JSON.</p>
        </div>
      </div>
    `;
  }
}

init();
