const getDateParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

export const getLocalDateKey = (date, timeZone) => {
  const parts = getDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const getLocalMinutes = (date, timeZone) => {
  const parts = getDateParts(date, timeZone);
  return Number(parts.hour) * 60 + Number(parts.minute);
};

export const getDueReminders = (reminders, date, timeZone) =>
  reminders
    .map((reminder, index) => ({ ...reminder, index }))
    .filter((reminder) => {
      if (!reminder.enabled || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time || '')) {
        return false;
      }
      const [hour, minute] = reminder.time.split(':').map(Number);
      return getLocalMinutes(date, timeZone) >= hour * 60 + minute;
    });

const getTimeZoneOffset = (date, timeZone) => {
  const parts = getDateParts(date, timeZone);
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  ) - date.getTime();
};

const getLocalMidnight = (dateKey, timeZone) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const offset = getTimeZoneOffset(new Date(utcMidnight), timeZone);
  return new Date(utcMidnight - offset);
};

export const getLocalDayBounds = (date, timeZone) => {
  const dateKey = getLocalDateKey(date, timeZone);
  const [year, month, day] = dateKey.split('-').map(Number);
  const nextDateKey = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);

  return {
    start: getLocalMidnight(dateKey, timeZone),
    end: getLocalMidnight(nextDateKey, timeZone),
  };
};
