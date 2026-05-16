# Term Weeks

System Admin defines the term start and end dates from the Calendar tab. Existing term dates can be edited by System Admin when a school calendar changes.

The backend derives school-friendly weeks from those dates:

- Week 1 starts on the term start date.
- Week 1 ends on the first Sunday after the term starts, or on the term end date if the term ends first.
- Week 2 and later run Monday to Sunday.
- The last week ends on the term end date, even when that date is not Sunday.

Example:

| Term Dates | Generated Weeks |
|---|---|
| Tuesday 2026-05-05 to Sunday 2026-05-31 | Week 1: 2026-05-05 to 2026-05-10; Week 2: 2026-05-11 to 2026-05-17; Week 3: 2026-05-18 to 2026-05-24; Week 4: 2026-05-25 to 2026-05-31 |

School Admin assignment screens use week dropdowns. The backend converts selected weeks into the existing `available_from` and `available_until` timestamps, so student visibility still uses the same availability checks.

When System Admin edits an existing term date range, the backend recalculates every week-based assignment for that term. This updates quiz assignment windows, typing assignment windows, and course module opening dates so reports, graphs, learner visibility, and teacher dashboards continue to reflect the corrected academic calendar.

Covered areas:

- Course module opening weeks
- Typing test assignment weeks
- Quiz assignment weeks

Endpoint:

- `GET /api/school-admin/term-weeks`
- `GET /api/school-admin/terms/:id/weeks`
- `PATCH /api/terms/:id`
