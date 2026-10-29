// Firefox exposes `browser`; Chrome only exposes `chrome`. Both return promises under MV3.
const extensionApi = globalThis.browser ?? globalThis.chrome;
const { SKILLS_STORAGE_KEY, LAST_RUN_STORAGE_KEY, parseSkillList } = globalThis.WorkdaySkillMatching;

// Order matters: run-filler.js uses the other two and must be last.
// The leading "/" is required: Firefox resolves bare paths against the popup page, not the extension root.
const INJECTED_FILES = ["/shared/skill-matching.js", "/content/workday-skills-filler.js", "/content/run-filler.js"];

const skillsTextarea = document.getElementById("skills");
const saveButton = document.getElementById("save");
const fillButton = document.getElementById("fill");
const statusText = document.getElementById("status");
const resultsList = document.getElementById("results");

const describeMatch = (result) => (result.matchedLabel ? ` as "${result.matchedLabel}"` : "");

const RESULT_DESCRIPTIONS = {
  added: (result) => `Added: ${result.skill}${describeMatch(result)}`,
  notConfirmed: (result) => `Clicked but not confirmed: ${result.skill}${describeMatch(result)} (check the page)`,
  notFound: (result) =>
    result.suggestions.length > 0
      ? `No exact match for "${result.skill}". Workday suggested: ${result.suggestions.join(", ")}`
      : `No match for "${result.skill}"`,
};

function showStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
}

function addResultLine(text, className) {
  const item = document.createElement("li");
  item.textContent = text;
  item.className = className;
  resultsList.append(item);
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

async function loadSkills() {
  const stored = await extensionApi.storage.local.get(SKILLS_STORAGE_KEY);
  skillsTextarea.value = (stored[SKILLS_STORAGE_KEY] ?? []).join("\n");
}

async function saveSkills() {
  const skills = parseSkillList(skillsTextarea.value);
  await extensionApi.storage.local.set({ [SKILLS_STORAGE_KEY]: skills });
  skillsTextarea.value = skills.join("\n");
  return skills;
}

// The fill script stores its own progress and results, so they survive this popup closing.
function renderLastRun(lastRun) {
  resultsList.replaceChildren();
  if (!lastRun) {
    showStatus("");
    return;
  }
  if (lastRun.state === "running") {
    showStatus(`Fill started at ${formatTime(lastRun.startedAt)} and hasn't finished yet. You can close this popup.`);
    return;
  }

  const { summary } = lastRun;
  const finishedAt = formatTime(lastRun.finishedAt);
  if (summary.error) {
    showStatus(`Last run (${finishedAt}) failed: ${summary.error}`, true);
    return;
  }
  for (const result of summary.results) addResultLine(RESULT_DESCRIPTIONS[result.status](result), result.status);
  for (const skill of summary.alreadySelected) addResultLine(`Already on page: ${skill}`, "alreadySelected");

  const addedCount = summary.results.filter((result) => result.status === "added").length;
  showStatus(
    `Last run (${finishedAt}): added ${addedCount} of ${summary.results.length} new skill(s), ` +
      `${summary.alreadySelected.length} already on page.`
  );
}

async function loadLastRun() {
  const stored = await extensionApi.storage.local.get(LAST_RUN_STORAGE_KEY);
  renderLastRun(stored[LAST_RUN_STORAGE_KEY]);
}

// Failures before the fill script starts (e.g. a script that won't load) are stored the
// same way as its results, so they are still visible after the popup closes.
function saveLastRunError(message) {
  const now = Date.now();
  const lastRun = { state: "done", startedAt: now, finishedAt: now, summary: { error: message } };
  return extensionApi.storage.local.set({ [LAST_RUN_STORAGE_KEY]: lastRun });
}

async function runFillerInActiveTab() {
  const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
  const [injection] = await extensionApi.scripting.executeScript({ target: { tabId: tab.id }, files: INJECTED_FILES });
  // Firefox reports load and script errors here instead of rejecting.
  if (injection.error) throw new Error(String(injection.error));
  return injection.result;
}

async function handleSave() {
  try {
    const skills = await saveSkills();
    showStatus(`Saved ${skills.length} skill(s).`);
  } catch (error) {
    showStatus(`Could not save: ${error.message}`, true);
  }
}

async function handleFill() {
  fillButton.disabled = true;
  try {
    const skills = await saveSkills();
    if (skills.length === 0) {
      showStatus("Add at least one skill first.", true);
      return;
    }
    const summary = await runFillerInActiveTab();
    // Results normally render via storage.onChanged. The one unstored outcome is the
    // "already running" refusal, which must not overwrite the running fill's record.
    if (summary?.error) showStatus(summary.error, true);
  } catch (error) {
    const message = `Could not fill skills: ${error.message}`;
    showStatus(message, true);
    await saveLastRunError(message);
  } finally {
    fillButton.disabled = false;
  }
}

extensionApi.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && LAST_RUN_STORAGE_KEY in changes) {
    renderLastRun(changes[LAST_RUN_STORAGE_KEY].newValue);
  }
});

saveButton.addEventListener("click", handleSave);
fillButton.addEventListener("click", handleFill);
Promise.all([loadSkills(), loadLastRun()]).catch((error) =>
  showStatus(`Could not load saved data: ${error.message}`, true)
);
