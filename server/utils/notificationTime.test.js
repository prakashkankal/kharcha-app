import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDueReminders,
  getLocalDateKey,
  getLocalDayBounds,
  getLocalMinutes,
} from './notificationTime.js';

describe('notification time zones', () => {
  it('calculates the local date, time, and day bounds in the selected time zone', () => {
    const now = new Date('2026-11-02T15:00:00.000Z');
    const bounds = getLocalDayBounds(now, 'Asia/Kolkata');

    assert.equal(getLocalDateKey(now, 'Asia/Kolkata'), '2026-11-02');
    assert.equal(getLocalMinutes(now, 'Asia/Kolkata'), 1230);
    assert.equal(bounds.start.toISOString(), '2026-11-01T18:30:00.000Z');
    assert.equal(bounds.end.toISOString(), '2026-11-02T18:30:00.000Z');
  });

  it('uses the correct 23-hour local day when daylight saving time begins', () => {
    const now = new Date('2026-03-08T12:00:00.000Z');
    const bounds = getLocalDayBounds(now, 'America/New_York');

    assert.equal(getLocalDateKey(now, 'America/New_York'), '2026-03-08');
    assert.equal(bounds.start.toISOString(), '2026-03-08T05:00:00.000Z');
    assert.equal(bounds.end.toISOString(), '2026-03-09T04:00:00.000Z');
  });

  it('uses the correct 25-hour local day when daylight saving time ends', () => {
    const now = new Date('2026-11-01T12:00:00.000Z');
    const bounds = getLocalDayBounds(now, 'America/New_York');

    assert.equal(getLocalDateKey(now, 'America/New_York'), '2026-11-01');
    assert.equal(bounds.start.toISOString(), '2026-11-01T04:00:00.000Z');
    assert.equal(bounds.end.toISOString(), '2026-11-02T05:00:00.000Z');
  });

  it('selects only enabled reminders whose local times have arrived', () => {
    const reminders = [
      { enabled: true, time: '12:00', message: 'Lunch' },
      { enabled: false, time: '15:00', message: 'Disabled' },
      { enabled: true, time: '21:00', message: 'Evening' },
    ];
    const due = getDueReminders(reminders, new Date('2026-11-02T13:00:00.000Z'), 'Asia/Kolkata');

    assert.deepEqual(due.map(({ index }) => index), [0]);
  });
});
