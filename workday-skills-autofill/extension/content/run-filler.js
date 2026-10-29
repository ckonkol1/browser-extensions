// Last file the popup injects, in the same executeScript call as the filler.
// It records progress and results in extension storage, because the popup
// usually closes (taking its state with it) before a fill finishes.
(async () => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const { SKILLS_STORAGE_KEY, LAST_RUN_STORAGE_KEY } = globalThis.WorkdaySkillMatching;
  const saveLastRun = (lastRun) => extensionApi.storage.local.set({ [LAST_RUN_STORAGE_KEY]: lastRun });

  // A second run started while one is in progress would read the field
  // mid-change and could add duplicates, which Workday rejects on submit.
  // The marker lives on the DOM so it is shared by every injection into this page.
  const pageRoot = document.documentElement;
  if (pageRoot.dataset.workdaySkillsAutofillRunning) {
    return { error: "A fill is already running on this page." };
  }
  pageRoot.dataset.workdaySkillsAutofillRunning = "true";

  const startedAt = Date.now();
  let summary;
  try {
    await saveLastRun({ state: "running", startedAt });
    const stored = await extensionApi.storage.local.get(SKILLS_STORAGE_KEY);
    summary = await globalThis.WorkdaySkillsFiller.fillSkills(stored[SKILLS_STORAGE_KEY] ?? []);
  } catch (error) {
    summary = { error: `The fill script failed: ${error.message}` };
  } finally {
    delete pageRoot.dataset.workdaySkillsAutofillRunning;
  }
  await saveLastRun({ state: "done", startedAt, finishedAt: Date.now(), summary });
  return summary;
})();
