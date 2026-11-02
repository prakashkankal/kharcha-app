import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';

describe('default expense reminders', () => {
  it('creates three enabled reminders with the default messages', () => {
    const user = new User({ name: 'Test User', email: 'test@example.com' });
    const notifications = user.settings.notifications;

    assert.equal(notifications.enabled, true);
    assert.deepEqual(
      notifications.reminders.map(({ enabled, time, message }) => ({ enabled, time, message })),
      [
        { enabled: true, time: '12:00', message: 'Had your lunch? Log your expense on Kharcha' },
        { enabled: true, time: '18:00', message: 'Have you added your afternoon expenses?' },
        { enabled: true, time: '21:00', message: 'Dinner time! Record your food expenses on Kharcha' },
      ]
    );
  });
});
