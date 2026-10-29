# Workday Skills Autofill

A Chrome and Firefox extension that fills the **Skills** section of a Workday job
application (the "My Experience" step) from a list you save once.

It works the way you would by hand: for each skill it types the name into
Workday's skills search, presses Enter, and clicks the matching suggestion
(see [How matching works](#how-matching-works)). Skills already on the page are
skipped. When nothing matches, the popup shows what Workday suggested so you
can adjust your list.

## Install

The same `extension/` folder works in both browsers.

**Firefox**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `extension/manifest.json`.

Temporary add-ons are removed when Firefox restarts. To keep it installed,
sign it as an unlisted add-on on [addons.mozilla.org](https://addons.mozilla.org/developers/)
(`npx web-ext sign --channel unlisted --source-dir extension` with your AMO API keys).

**Chrome / Edge**

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `extension` folder.

## Use

1. Click the extension icon and enter your skills, one per line or comma-separated.
2. Open a Workday application and go to the **My Experience** step.
3. Click the icon again, then **Fill skills on this page**. You can close the
   popup; the fill keeps running, and reopening the popup shows the last run's
   results (what was added, already there, or not matched and why).

Re-running is safe: before each skill it checks the field and skips anything
already there, and a second fill can't start on a page while one is running.

## How matching works

Workday only accepts skills from its own catalog, and its names often differ
from how people write them. A wrong pick lands on a real application, so
matching is deliberately strict. For each skill, in order:

1. **Exact match**, ignoring case, extra spaces, and hyphen vs. space.
   `event-driven architecture` matches "Event Driven Architecture".
2. **Qualifier or acronym match**: Workday's name is yours plus a trailing
   `(…)`, or yours is the acronym in its parentheses. This is used only when
   exactly one suggestion qualifies; if two do, nothing is picked.
3. **Otherwise nothing is clicked.** The popup lists Workday's suggestions so
   you can copy the right name into your list.

The same rules decide whether a skill is already on the page, so `Java` is
skipped if "Java (Programming Language)" is already there.

Examples from a live Workday application:

| Your list | Workday's name | Result |
|---|---|---|
| `Kubernetes` | Kubernetes | Exact match |
| `Event-Driven Architecture` | Event Driven Architecture (EDA) | Qualifier match (hyphen ignored) |
| `Java` | Java (Programming Language) | Qualifier match |
| `Docker` | Docker (Software) | Qualifier match |
| `SQL` | Structured Query Language (SQL) | Acronym match |
| `C Sharp` | C Sharp (Programming Language) | Qualifier match |
| `C#` | C Sharp (Programming Language) | No match: rename to `C Sharp` |
| `Mentoring` | Mentorship | No match: rename to `Mentorship` |
| `Code Review` | Code Reviews | No match: rename to `Code Reviews` |

Popup results:

| Line | Meaning |
|---|---|
| `Added: X` | Clicked and confirmed in the field. `as "…"` shows the Workday name used. |
| `Already on page: X` | Skipped; it was already in the field. |
| `No exact match for "X". Workday suggested: …` | Search ran, nothing qualified. Rename using a suggestion. |
| `No match for "X"` | Workday returned no suggestions. |
| `Clicked but not confirmed: X` | Clicked a match but didn't see it appear. Check the field. |

## Example skill list

A starting point for a senior software engineer. Names already adjusted toward
Workday's catalog (e.g. `C Sharp`, `NET Framework`, `Code Reviews`, `Mentorship`).
Paste it into the popup as-is; one per line.

```text
SOLID Principles
Software Design Patterns
Software Architecture
Clean Architecture
Microservices
Service-Oriented Architecture
RESTful APIs
API Design
Distributed Systems
Event-Driven Architecture
Java
Spring Boot
JavaScript
Node.js
TypeScript
C Sharp
NET Framework
Amazon Web Services (AWS)
Docker
Kubernetes
CI/CD
Jenkins
GitHub Actions
GitLab CI/CD
Git
AI-Assisted Software Development
GitHub Copilot
Claude Code
Code Reviews
Technical Documentation
Unit Testing
Integration Testing
Test-Driven Development
SQL
PostgreSQL
Apache Kafka
Agile Methodologies
Scrum
Stakeholder Management
Mentorship
```

Some of these may still come back unmatched. On one live application
`Software Architecture`, `Microservices`, `Claude Code`, and
`Technical Documentation` had no exact or qualifier match (Workday offered
"Software Architectures", "Microservices Architecture", "Anthropic Claude Code",
and "Technical Documents"). Use whichever suggestion fits.

## Permissions and data

- `activeTab` + `scripting`: the fill script is injected only into the tab you
  are on, and only when you click **Fill**. The extension has no standing access
  to any website.
- `storage`: your skill list is kept in the browser's local extension storage.
  Nothing is sent anywhere.

## Limitations

- Matching is strict by design; see [How matching works](#how-matching-works).
- Workday's markup isn't documented. Checked on a live application so far: the
  search box, reading skills already in the field, and the suggestion list
  (including that chosen values elsewhere on the page use the same markup).
  Not yet confirmed: that clicking a suggestion adds it reliably. If results
  are mostly "not confirmed" or "No match", inspect the elements and update
  `SELECTORS` in [`extension/content/workday-skills-filler.js`](extension/content/workday-skills-filler.js).
- Only the Skills field is filled.

## Develop

```bash
npm install
npm test
npm run lint
```

`test/fixtures/workday-skills-mock.html` imitates Workday's skills widget for
manual testing. Serve the repo over HTTP (for example
`python -m http.server 8765 --bind 127.0.0.1`), open
`http://localhost:8765/test/fixtures/workday-skills-mock.html`, and either run
the extension on it or call `WorkdaySkillsFiller.fillSkills(["Java", "SQL"])`
from the console. The page loads the filler script itself.
