const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createThrottle(intervalMs, { wait = sleep, now = Date.now, random = Math.random } = {}) {
  let nextAt = 0;
  return async function throttle() {
    const delay = nextAt - now();
    if (delay > 0) {
      await wait(delay);
    }
    nextAt = now() + Math.round(intervalMs * (0.75 + random() * 0.5));
  };
}

export function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function romeToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(now);
}

export function addDays(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function dateRange(start, end) {
  const dates = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}
