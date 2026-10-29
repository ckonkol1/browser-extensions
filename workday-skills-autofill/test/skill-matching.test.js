const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeSkillName,
  parseSkillList,
  findExactOptionIndex,
  findMatchingOptionIndex,
  partitionBySelected,
} = require("../extension/shared/skill-matching.js");

test("normalizeSkillName trims, collapses whitespace, and lowercases", () => {
  assert.equal(normalizeSkillName("  Amazon   Web Services "), "amazon web services");
});

test("normalizeSkillName treats hyphens as spaces", () => {
  assert.equal(normalizeSkillName("Event-Driven Architecture"), normalizeSkillName("Event Driven Architecture"));
});

test("parseSkillList splits on newlines and commas", () => {
  assert.deepEqual(parseSkillList("Java, Python\nSQL\r\nC#"), ["Java", "Python", "SQL", "C#"]);
});

test("parseSkillList drops blanks and case-insensitive duplicates, keeping the first spelling", () => {
  assert.deepEqual(parseSkillList("JavaScript\n\n  javascript \n,  ,Go"), ["JavaScript", "Go"]);
});

test("parseSkillList returns an empty list for blank input", () => {
  assert.deepEqual(parseSkillList("  \n , "), []);
});

test("findExactOptionIndex matches ignoring case and spacing", () => {
  assert.equal(findExactOptionIndex("javascript", ["Java", "JavaScript", "JavaScript Frameworks"]), 1);
});

test("findExactOptionIndex does not accept partial matches", () => {
  assert.equal(findExactOptionIndex("React", ["React.js", "React Native"]), -1);
});

// Labels below are real Workday suggestions from a live application.
test("findMatchingOptionIndex prefers an exact match over an alias match", () => {
  assert.equal(findMatchingOptionIndex("Docker", ["Docker (Software)", "Docker"]), 1);
});

test("findMatchingOptionIndex ignores a trailing qualifier in the Workday name", () => {
  assert.equal(findMatchingOptionIndex("Java", ["Java (Programming Language)", "JavaFX", "Java2D"]), 0);
});

test("findMatchingOptionIndex matches the acronym in parentheses", () => {
  assert.equal(findMatchingOptionIndex("SQL", ["Structured Query Language (SQL)", "U-SQL", "SQLCLR"]), 0);
});

test("findMatchingOptionIndex combines hyphen and qualifier handling", () => {
  const labels = ["Event Driven Architecture (EDA)", "Cognitive Architecture", "Event-Driven Programming"];
  assert.equal(findMatchingOptionIndex("Event-Driven Architecture", labels), 0);
});

test("findMatchingOptionIndex matches when the qualifier is on the user's side", () => {
  assert.equal(findMatchingOptionIndex("Amazon Web Services (AWS)", ["AWS Lambda", "AWS"]), 1);
});

test("findMatchingOptionIndex refuses when more than one alias matches", () => {
  assert.equal(findMatchingOptionIndex("Go", ["Go (Programming Language)", "Go (Game)"]), -1);
});

test("findMatchingOptionIndex does not guess at different words", () => {
  assert.equal(findMatchingOptionIndex("C#", ["C Sharp (Programming Language)", "Unity C#"]), -1);
  assert.equal(findMatchingOptionIndex("Mentoring", ["Mentorship", "IT Mentoring"]), -1);
});

test("partitionBySelected treats an alias-matching pill as already selected", () => {
  assert.deepEqual(partitionBySelected(["Java", "SQL"], ["Java (Programming Language)"]), {
    toAdd: ["SQL"],
    alreadySelected: ["Java"],
  });
});

test("partitionBySelected separates skills already on the page", () => {
  assert.deepEqual(partitionBySelected(["Java", "SQL", "Go"], ["sql", "Rust"]), {
    toAdd: ["Java", "Go"],
    alreadySelected: ["SQL"],
  });
});
