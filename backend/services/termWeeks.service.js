function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parseDateOnly(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return null;
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function minDate(a, b) {
  return a.getTime() <= b.getTime() ? a : b;
}

function buildTermWeeks(term) {
  const start = parseDateOnly(term?.starts_on);
  const end = parseDateOnly(term?.ends_on);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const weeks = [];
  let currentStart = start;
  let weekNumber = 1;

  while (currentStart.getTime() <= end.getTime()) {
    const day = currentStart.getUTCDay();
    const daysToSunday = (7 - day) % 7;
    const currentEnd = minDate(addDays(currentStart, daysToSunday), end);
    const startsOn = formatDateOnly(currentStart);
    const endsOn = formatDateOnly(currentEnd);

    weeks.push({
      week_number: weekNumber,
      label: `Week ${weekNumber}`,
      starts_on: startsOn,
      ends_on: endsOn,
      available_from: `${startsOn}T00:00:00`,
      available_until: `${endsOn}T23:59:59`
    });

    currentStart = addDays(currentEnd, 1);
    weekNumber += 1;
  }

  return weeks;
}

function findWeek(term, weekNumber) {
  const normalized = Number(weekNumber);
  if (!Number.isInteger(normalized) || normalized < 1) return null;
  return buildTermWeeks(term).find((week) => week.week_number === normalized) || null;
}

function availabilityForWeek(term, weekNumber) {
  const week = findWeek(term, weekNumber);
  if (!week) return null;
  return {
    available_from: week.available_from,
    available_until: week.available_until,
    week
  };
}

function moduleOpenDateForWeek(term, weekNumber) {
  const week = findWeek(term, weekNumber);
  return week ? week.available_from : null;
}

module.exports = {
  buildTermWeeks,
  availabilityForWeek,
  moduleOpenDateForWeek
};
