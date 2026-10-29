// Injected into the Workday tab on demand by the popup. Drives Workday's
// "Skills" multiselect the way a person would: type, press Enter, click the
// matching suggestion.
(() => {
  const { findExactOptionIndex, findMatchingOptionIndex, normalizeSkillName, partitionBySelected } =
    globalThis.WorkdaySkillMatching;

  // The search box selectors were confirmed on a live Workday application
  // (Oct 2026). A live run also showed that Workday marks values already chosen
  // (skill pills, Education's field of study) as promptOption too. The
  // suggestion-list markup itself is still a best guess; if filling breaks, start here.
  const SELECTORS = {
    skillsInput: [
      "input#skills--skills",
      '[data-automation-id="formField-skills"] input[data-automation-id="searchBox"]',
      'input[data-uxi-widget-type="selectinput"][id^="skills"]',
    ],
    fieldContainer: '[data-automation-id^="formField-"]',
    option: '[data-automation-id="promptOption"], [role="option"]',
    selectedItem: '[data-automation-id="selectedItem"]',
    listbox: '[role="listbox"], [data-automation-id="activeListContainer"]',
  };

  const TIMING = {
    pollIntervalMs: 100,
    searchTimeoutMs: 5000,
    // A non-matching result list counts as final once it has stopped changing this long.
    resultsSettleMs: 700,
    selectionTimeoutMs: 3000,
    listCloseTimeoutMs: 1000,
  };

  const NO_RESULTS_PATTERN = /no (items|results|matches)/i;
  const MAX_SUGGESTIONS_REPORTED = 5;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function findSkillsInput() {
    for (const selector of SELECTORS.skillsInput) {
      const input = document.querySelector(selector);
      if (input) return input;
    }
    return null;
  }

  function findFieldContainer(input) {
    return input.closest(SELECTORS.fieldContainer) ?? input.parentElement;
  }

  function isVisible(element) {
    return element.getClientRects().length > 0;
  }

  function labelOf(element) {
    return (element.getAttribute("data-automation-label") ?? element.textContent).trim();
  }

  function readSelectedSkills(field) {
    return [...field.querySelectorAll(SELECTORS.selectedItem)].map(labelOf).filter(Boolean);
  }

  function isSkillSelected(field, skill) {
    return partitionBySelected([skill], readSelectedSkills(field)).alreadySelected.length === 1;
  }

  // Values already chosen use the same option markup as suggestions. Clicking
  // one of those could remove it, so anything inside a chosen value or inside
  // a different form field is never treated as a suggestion.
  function isSearchSuggestion(element, field) {
    if (element.closest(SELECTORS.selectedItem)) return false;
    const owningField = element.closest(SELECTORS.fieldContainer);
    return owningField === null || owningField === field;
  }

  // A live run listed every suggestion twice: Workday nests one option element
  // inside another. Keeping only the innermost removes the duplicate, and a click
  // on it bubbles up, so it reaches a handler on either element.
  function isInnermostOption(element) {
    return element.querySelector(SELECTORS.option) === null;
  }

  // Workday may render the suggestion list in a portal outside the field, so search the whole page.
  function readVisibleOptions(field) {
    return [...document.querySelectorAll(SELECTORS.option)]
      .filter((element) => isInnermostOption(element) && isVisible(element) && isSearchSuggestion(element, field))
      .map((element) => ({ element, label: labelOf(element) }))
      .filter((option) => option.label);
  }

  function isNoResultsMessageVisible() {
    return [...document.querySelectorAll(SELECTORS.listbox)].some(
      (listbox) => isVisible(listbox) && NO_RESULTS_PATTERN.test(listbox.textContent)
    );
  }

  // Workday's inputs are React-controlled: React only notices a change when the
  // native value setter runs and an "input" event follows.
  function setInputValue(input, value) {
    const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    nativeValueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const KEY_CODES = { Enter: 13, Escape: 27 };

  function pressKey(element, key) {
    const init = { key, code: key, keyCode: KEY_CODES[key], which: KEY_CODES[key], bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent("keydown", init));
    element.dispatchEvent(new KeyboardEvent("keyup", init));
  }

  // Some Workday widgets act on hover or mousedown rather than click, so send the full sequence.
  function clickLikeUser(element) {
    const init = { bubbles: true, cancelable: true, button: 0 };
    element.dispatchEvent(new PointerEvent("pointerover", init));
    element.dispatchEvent(new MouseEvent("mouseover", init));
    element.dispatchEvent(new PointerEvent("pointerdown", init));
    element.dispatchEvent(new MouseEvent("mousedown", init));
    element.dispatchEvent(new PointerEvent("pointerup", init));
    element.dispatchEvent(new MouseEvent("mouseup", init));
    element.dispatchEvent(new MouseEvent("click", init));
  }

  function optionsSignature(options) {
    return options.map((option) => option.label).join("\n");
  }

  // staleSignature is the list that was showing before this search. If the previous
  // list never closed, it must not be mistaken for this search's results.
  async function waitForSearchResults(field, skill, staleSignature) {
    const deadline = Date.now() + TIMING.searchTimeoutMs;
    let previousSignature = null;
    let unchangedSince = Date.now();

    while (Date.now() < deadline) {
      if (isNoResultsMessageVisible()) return [];

      const options = readVisibleOptions(field);
      if (findExactOptionIndex(skill, options.map((option) => option.label)) !== -1) return options;

      const signature = optionsSignature(options);
      if (signature !== previousSignature) {
        previousSignature = signature;
        unchangedSince = Date.now();
      } else if (
        options.length > 0 &&
        signature !== staleSignature &&
        Date.now() - unchangedSince >= TIMING.resultsSettleMs
      ) {
        return options;
      }
      await sleep(TIMING.pollIntervalMs);
    }
    const finalOptions = readVisibleOptions(field);
    return optionsSignature(finalOptions) === staleSignature ? [] : finalOptions;
  }

  async function waitUntil(condition, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (condition()) return true;
      await sleep(TIMING.pollIntervalMs);
    }
    return condition();
  }

  async function closeSuggestionList(input, field) {
    setInputValue(input, "");
    pressKey(input, "Escape");
    await waitUntil(() => readVisibleOptions(field).length === 0, TIMING.listCloseTimeoutMs);
  }

  async function addSkill(input, field, skill) {
    const staleSignature = optionsSignature(readVisibleOptions(field));
    input.focus();
    setInputValue(input, skill);
    pressKey(input, "Enter");

    const options = await waitForSearchResults(field, skill, staleSignature);
    const matchIndex = findMatchingOptionIndex(skill, options.map((option) => option.label));
    if (matchIndex === -1) {
      await closeSuggestionList(input, field);
      const suggestions = options.slice(0, MAX_SUGGESTIONS_REPORTED).map((option) => option.label);
      return { skill, status: "notFound", suggestions };
    }

    const { element, label: matchedLabel } = options[matchIndex];
    clickLikeUser(element);
    const selected = await waitUntil(() => isSkillSelected(field, skill), TIMING.selectionTimeoutMs);
    await closeSuggestionList(input, field);
    const result = { skill, status: selected ? "added" : "notConfirmed" };
    if (normalizeSkillName(matchedLabel) !== normalizeSkillName(skill)) result.matchedLabel = matchedLabel;
    return result;
  }

  async function fillSkills(requestedSkills) {
    const input = findSkillsInput();
    if (!input) {
      return { error: "No Workday Skills field found on this page. Open the My Experience step first." };
    }
    const field = findFieldContainer(input);

    // Duplicates make Workday reject the application on submit, so check the
    // field again before every skill rather than once up front.
    const alreadySelected = [];
    const results = [];
    for (const skill of requestedSkills) {
      if (isSkillSelected(field, skill)) {
        alreadySelected.push(skill);
      } else {
        results.push(await addSkill(input, field, skill));
      }
    }
    return { alreadySelected, results };
  }

  globalThis.WorkdaySkillsFiller = { fillSkills };
})();
