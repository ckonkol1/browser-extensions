// Pure helpers shared by the popup, the injected filler, and the Node tests.
// Loaded as a classic script in the browser and via require() in Node.
(() => {
  const SKILLS_STORAGE_KEY = "skills";
  const LAST_RUN_STORAGE_KEY = "lastRun";

  // "Java (Programming Language)" -> name "Java", qualifier "Programming Language".
  const TRAILING_QUALIFIER = /^(.*\S)\s*\(([^()]+)\)$/;

  // Workday's catalog mixes "Event-Driven" and "Event Driven", so hyphens count as spaces.
  function normalizeSkillName(name) {
    return name.trim().replace(/[\s-]+/g, " ").toLowerCase();
  }

  // Accepts one skill per line or comma-separated; drops blanks and case-insensitive duplicates.
  function parseSkillList(text) {
    const seen = new Set();
    const skills = [];
    for (const rawSkill of text.split(/[\n,]/)) {
      const skill = rawSkill.trim().replace(/\s+/g, " ");
      const key = normalizeSkillName(skill);
      if (skill && !seen.has(key)) {
        seen.add(key);
        skills.push(skill);
      }
    }
    return skills;
  }

  function isExactMatch(skill, label) {
    return normalizeSkillName(skill) === normalizeSkillName(label);
  }

  // The name and qualifier of "Name (Qualifier)", so "Docker" matches "Docker (Software)"
  // and "SQL" matches "Structured Query Language (SQL)".
  function aliasesOf(name) {
    const parts = name.match(TRAILING_QUALIFIER);
    return parts ? [parts[1], parts[2]].map(normalizeSkillName) : [];
  }

  function isAliasMatch(skill, label) {
    return aliasesOf(label).includes(normalizeSkillName(skill)) || aliasesOf(skill).includes(normalizeSkillName(label));
  }

  function skillMatchesLabel(skill, label) {
    return isExactMatch(skill, label) || isAliasMatch(skill, label);
  }

  function findExactOptionIndex(skill, optionLabels) {
    return optionLabels.findIndex((label) => isExactMatch(skill, label));
  }

  // Prefers an exact match. Falls back to an alias match only when exactly one
  // distinct label qualifies, so an ambiguous search never picks a skill.
  function findMatchingOptionIndex(skill, optionLabels) {
    const exactIndex = findExactOptionIndex(skill, optionLabels);
    if (exactIndex !== -1) return exactIndex;

    const aliasIndexes = optionLabels.flatMap((label, index) => (isAliasMatch(skill, label) ? [index] : []));
    const distinctLabels = new Set(aliasIndexes.map((index) => normalizeSkillName(optionLabels[index])));
    return distinctLabels.size === 1 ? aliasIndexes[0] : -1;
  }

  // Alias matches count as selected too: a pill reading "Java (Programming Language)"
  // means "Java" is already there, and adding it again would be a duplicate.
  function partitionBySelected(requestedSkills, selectedLabels) {
    const toAdd = [];
    const alreadySelected = [];
    for (const skill of requestedSkills) {
      const isSelected = selectedLabels.some((label) => skillMatchesLabel(skill, label));
      (isSelected ? alreadySelected : toAdd).push(skill);
    }
    return { toAdd, alreadySelected };
  }

  const api = {
    SKILLS_STORAGE_KEY,
    LAST_RUN_STORAGE_KEY,
    normalizeSkillName,
    parseSkillList,
    findExactOptionIndex,
    findMatchingOptionIndex,
    partitionBySelected,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalThis.WorkdaySkillMatching = api;
  }
})();
