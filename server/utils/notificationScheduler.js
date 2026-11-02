import webPush from 'web-push';
import Expense from '../models/Expense.js';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';
import { getDueReminders, getLocalDateKey, getLocalDayBounds } from './notificationTime.js';

const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
const EXPENSE_URL = '/add-expense';
let schedulerInterval;
let isRunning = false;

const isValidTimeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

const sendReminder = async (subscription, title, message) => {
  const payload = JSON.stringify({
    title,
    body: message,
    url: EXPENSE_URL,
  });

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        expirationTime: subscription.expirationTime,
      },
      payload,
      { TTL: 86400, urgency: 'normal' }
    );
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await PushSubscription.deleteOne({ _id: subscription._id });
      return false;
    }
    console.error(`Failed to send expense reminder to subscription ${subscription._id}:`, error.message);
    return false;
  }
};

export const runNotificationScheduler = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    const users = await User.find({ 'settings.notifications.enabled': true })
      .select('_id settings.notifications')
      .lean();

    for (const user of users) {
      const settings = user.settings?.notifications;
      if (!settings?.enabled) continue;

      const timeZone = isValidTimeZone(settings?.timezone) ? settings.timezone : DEFAULT_TIME_ZONE;
      const reminders =
        Array.isArray(settings.reminders) && settings.reminders.length === 3
          ? settings.reminders
          : [
              {
                enabled: true,
                time: settings.time || '21:00',
                message:
                  settings.message || "Don't forget to add today's expenses in Kharcha!",
              },
            ];
      const dueReminders = getDueReminders(reminders, now, timeZone);
      if (dueReminders.length === 0) continue;

      const dateKey = getLocalDateKey(now, timeZone);
      const subscriptions = await PushSubscription.find({ userId: user._id }).lean();
      if (subscriptions.length === 0) continue;

      const { start, end } = getLocalDayBounds(now, timeZone);
      const hasExpenseToday = await Expense.exists({
        userId: user._id,
        transactionType: 'expense',
        date: { $gte: start, $lt: end },
      });

      if (hasExpenseToday) {
        const notifiedDates = { lastNotifiedDate: dateKey };
        for (const { index } of dueReminders) {
          notifiedDates[`lastNotifiedReminder${index + 1}Date`] = dateKey;
        }
        await PushSubscription.updateMany({ userId: user._id }, { $set: notifiedDates });
        continue;
      }

      for (const reminder of dueReminders) {
        const notifiedDateField = `lastNotifiedReminder${reminder.index + 1}Date`;
        const message =
          typeof reminder.message === 'string' && reminder.message.trim()
            ? reminder.message.trim()
            : "Don't forget to add today's expenses in Kharcha!";

        for (const subscription of subscriptions) {
          if (subscription[notifiedDateField] === dateKey) continue;

          const claim = await PushSubscription.updateOne(
            { _id: subscription._id, [notifiedDateField]: { $ne: dateKey } },
            { $set: { [notifiedDateField]: dateKey, lastNotifiedDate: dateKey } }
          );
          if (claim.modifiedCount !== 1) continue;

          const sent = await sendReminder(
            subscription,
            `Kharcha expense reminder ${reminder.index + 1}`,
            message
          );
          if (!sent) {
            await PushSubscription.updateOne(
              { _id: subscription._id },
              { $set: { [notifiedDateField]: subscription[notifiedDateField] || '' } }
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('Expense reminder scheduler failed:', error.message);
  } finally {
    isRunning = false;
  }
};

export const startNotificationScheduler = () => {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.warn('Push reminders are disabled: configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.');
    return;
  }

  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  runNotificationScheduler();
  schedulerInterval = setInterval(runNotificationScheduler, 60_000);
  schedulerInterval.unref();
};
