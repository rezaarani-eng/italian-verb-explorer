const state = {
  data: null,
  selected: null,
  matches: [],
  activeTab: "presente"
};

const requestedTabs = [
  {
    id: "presente",
    label: "Presente",
    matcher: form => normalize(form.tense) === "presente",
    description: "Current actions, habits, and general truths."
  },
  {
    id: "futuro-semplice",
    label: "Futuro semplice",
    matcher: form => normalize(form.tense) === "futuro semplice",
    description: "What will happen later or what someone will do."
  },
  {
    id: "futuro-anteriore",
    label: "Futuro anteriore",
    matcher: form => normalize(form.tense) === "futuro anteriore",
    description: "What will have happened before another future moment."
  },
  {
    id: "congiuntivo",
    label: "Congiuntivo",
    matcher: form => normalize(form.mood).includes("congiuntivo") || normalize(form.tense).includes("congiuntivo"),
    description: "Subjunctive forms for doubt, hope, judgment, and dependent clauses."
  }
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

function slugify(text = "") {
  return normalize(text).replace(/\s+/g, "-") || "section";
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
  const formBlob = normalize(verb.forms.map(f => `${f.focus || ""} ${f.italian || ""} ${f.english || ""}`).join(" "));

  if (lemma === q) return 100;
  if (lemma.startsWith(q)) return 86;
  if (title.includes(q)) return 72;
  if (meaning.includes(q)) return 52;
  if (formBlob.includes(q)) return 34;
  return 0;
}

function findMatches(query) {
  const matches = state.data.verbs
    .map(verb => ({ verb, score: scoreVerb(verb, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.verb.index - b.verb.index)
    .map(item => item.verb);

  return matches.length ? matches : state.data.verbs.slice(0, 16);
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
    document.querySelector("#explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderMatchList(query = "") {
  state.matches = findMatches(query).slice(0, 18);
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

function getTabGroups(verb) {
  const assigned = new WeakSet();

  const tabs = requestedTabs.map(tab => {
    const forms = verb.forms.filter(form => tab.matcher(form));
    forms.forEach(form => assigned.add(form));
    return { ...tab, forms };
  });

  const otherMap = new Map();
  for (const form of verb.forms) {
    if (assigned.has(form)) continue;
    const key = form.tense || form.mood || "Other forms";
    if (!otherMap.has(key)) otherMap.set(key, []);
    otherMap.get(key).push(form);
  }

  const others = [...otherMap.entries()].map(([label, forms]) => ({
    id: slugify(label),
    label,
    description: "Additional forms available in your current sheet.",
    forms,
    isOther: true
  }));

  return { tabs, others };
}

function sectionTitle(group) {
  if (!group.forms.length) return group.label;
  const uniqueTenses = [...new Set(group.forms.map(form => form.tense).filter(Boolean))];
  return uniqueTenses.length === 1 ? uniqueTenses[0] : group.label;
}

function tabTargetId(verb, tabId) {
  return `${slugify(verb.lemma)}-${tabId}`;
}

function setActiveTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll(".tab-button").forEach(button => {
    button.classList.toggle("active", button.dataset.tabId === tabId);
  });
}

function scrollToTab(verb, tabId) {
  const target = document.getElementById(tabTargetId(verb, tabId));
  if (!target) return;
  setActiveTab(tabId);
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTabs(verb, groups) {
  const firstAvailable = groups.tabs.find(tab => tab.forms.length > 0)?.id || groups.tabs[0].id;
  state.activeTab = firstAvailable;

  return `
    <div class="tense-tabs-wrap" aria-label="Tense navigation">
      <div class="tense-tabs" role="tablist">
        ${groups.tabs.map(tab => `
          <button
            class="tab-button ${tab.id === firstAvailable ? "active" : ""}"
            type="button"
            role="tab"
            data-tab-id="${escapeHtml(tab.id)}"
            ${tab.forms.length ? "" : "disabled"}
            aria-label="Jump to ${escapeHtml(tab.label)}">
            <span class="tab-label">${escapeHtml(tab.label)}</span>
            <span class="tab-count">${tab.forms.length}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSection(verb, group, query = "") {
  if (!group.forms.length) return "";
  const id = group.isOther ? `${slugify(verb.lemma)}-other-${group.id}` : tabTargetId(verb, group.id);
  const title = sectionTitle(group);

  return `
    <section class="tense-section" id="${escapeHtml(id)}" data-tab-section="${escapeHtml(group.id)}">
      <div class="tense-heading">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(group.description)}</p>
        </div>
        <small>${group.forms.length} forms</small>
      </div>
      <div class="card-grid">
        ${group.forms.map(form => `
          <article class="form-card">
            <div class="card-topline">
              <span class="person">${escapeHtml(form.person)}</span>
              <span class="mood">${escapeHtml(form.mood || "")}</span>
            </div>
            <p class="focus-form">${highlight(form.focus || "—", query)}</p>
            <p class="italian">${highlight(form.italian || "", query)}</p>
            <p class="english">${highlight(form.english || "", query)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function copyVerb(verb) {
  const { tabs, others } = getTabGroups(verb);
  const orderedGroups = [...tabs, ...others].filter(group => group.forms.length > 0);
  const lines = [
    `${verb.lemma} — ${verb.meaning || ""}`,
    "",
    ...orderedGroups.flatMap(group => [
      sectionTitle(group),
      ...group.forms.map(form => `${form.person}: ${form.focus ? form.focus + " — " : ""}${form.italian || ""} — ${form.english || ""}`),
      ""
    ])
  ];

  navigator.clipboard.writeText(lines.join("\n"));
}

function renderVerb(verb, query = "") {
  state.selected = verb;
  const groups = getTabGroups(verb);
  const note = verb.note ? `<p class="note">${escapeHtml(verb.note)}</p>` : "";
  const futuroAnterioreMissing = !groups.tabs.find(tab => tab.id === "futuro-anteriore")?.forms.length;
  const warning = futuroAnterioreMissing
    ? `<p class="tab-warning"><strong>Futuro anteriore is ready as a tab,</strong> but this current data file does not contain Futuro anteriore rows yet. If your Google Sheet adds that section later, the tab will automatically become active.</p>`
    : "";

  const mainSections = groups.tabs.map(group => renderSection(verb, group, query)).join("");
  const otherSections = groups.others.length
    ? `
      <div class="meta-row" aria-label="Other available groups">
        <span class="pill">Extra group from sheet</span>
        ${groups.others.map(group => `<span class="pill">${escapeHtml(group.label)} · ${group.forms.length}</span>`).join("")}
      </div>
      ${groups.others.map(group => renderSection(verb, group, query)).join("")}
    `
    : "";

  els.verbPanel.innerHTML = `
    <div class="verb-title-row">
      <div>
        <p class="eyebrow">Selected verb</p>
        <h2>${highlight(verb.lemma, query)}</h2>
        <p class="meaning">${escapeHtml(verb.meaning || "")}</p>
        ${note}
      </div>
      <button class="copy-button" type="button" id="copyVerb">Copy all forms</button>
    </div>

    <div class="meta-row">
      <span class="pill">#${verb.index}</span>
      <span class="pill">${verb.forms.length} total cards</span>
      <span class="pill">Italian + English</span>
      <span class="pill">Clickable tense tabs</span>
    </div>

    ${renderTabs(verb, groups)}
    ${warning}

    <div class="tense-stack">
      ${mainSections}
      ${otherSections}
    </div>
  `;

  document.querySelector("#copyVerb").addEventListener("click", () => copyVerb(verb));
  document.querySelectorAll(".tab-button[data-tab-id]").forEach(button => {
    button.addEventListener("click", () => scrollToTab(verb, button.dataset.tabId));
  });

  renderMatchList(query);
}

function renderEmpty(query) {
  els.verbPanel.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-card">
        <strong>No exact match yet.</strong>
        <p>Choose a verb from the index, or try a broader search such as “hug”, “predict”, “lie”, or “marry”.</p>
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
      document.querySelector("#explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <div class="empty-state-card">
          <strong>Could not load verb data.</strong>
          <p>Check that <code>site/data/verbs.json</code> exists and is valid JSON.</p>
        </div>
      </div>
    `;
  }
}

init();
