const JST_TIME_ZONE = "Asia/Tokyo";

function formatJstDate(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addOneCalendarMonth(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const targetMonth = month === 12 ? 1 : month + 1;
  const targetYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function bookingDateRange(now = new Date()) {
  const minDate = formatJstDate(now);
  return { minDate, maxDate: addOneCalendarMonth(minDate) };
}

export function isBookableDate(date: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime()) || formatJstDate(parsed) !== date) return false;
  const { minDate, maxDate } = bookingDateRange(now);
  return date >= minDate && date <= maxDate;
}
