import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/notificationApi';
import { profileApi } from '../services/profileApi';

const DEFAULT_REMINDERS = [
  { enabled: true, time: '12:00', message: 'Had your lunch? Log your expense on Kharcha' },
  { enabled: true, time: '18:00', message: 'Have you added your afternoon expenses?' },
  { enabled: true, time: '21:00', message: 'Dinner time! Record your food expenses on Kharcha' },
];

const LEGACY_DEFAULT_MESSAGES = [
  "Don't forget to add today's expenses in Kharcha!",
  'Have you added your afternoon expenses?',
  "Don't forget to log today's expenses before the day ends!",
];

const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

const getReminderSettings = (settings) => {
  if (Array.isArray(settings?.reminders) && settings.reminders.length === 3) {
    return settings.reminders.map((reminder, index) => ({
      ...DEFAULT_REMINDERS[index],
      ...reminder,
      message:
        reminder.message === LEGACY_DEFAULT_MESSAGES[index]
          ? DEFAULT_REMINDERS[index].message
          : reminder.message,
    }));
  }

  const reminders = DEFAULT_REMINDERS.map((reminder) => ({ ...reminder }));
  if (settings?.enabled && settings.time && settings.message) {
    reminders[0] = {
      ...reminders[0],
      time: settings.time,
      message:
        settings.message === LEGACY_DEFAULT_MESSAGES[0]
          ? DEFAULT_REMINDERS[0].message
          : settings.message,
    };
  }
  return reminders;
};

export const ExpenseReminders = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [reminders, setReminders] = useState(() =>
    getReminderSettings(user?.settings?.notifications)
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleSave = async (event) => {
    event.preventDefault();
    setMsg({ type: '', text: '' });
    setLoading(true);
    const enabledCount = reminders.filter((reminder) => reminder.enabled).length;

    try {
      if (enabledCount > 0) {
        await notificationApi.subscribe();
      }

      const updated = await profileApi.updateProfile({
        notifications: {
          reminders,
          timezone: getBrowserTimeZone(),
        },
      });
      updateUser(updated);

      if (enabledCount === 0) {
        await notificationApi.unsubscribe();
      }

      setMsg({
        type: 'success',
        text:
          enabledCount > 0
            ? `${enabledCount} daily reminder${enabledCount === 1 ? '' : 's'} saved`
            : 'Daily reminders disabled',
      });
    } catch (error) {
      setMsg({ type: 'error', text: error.message || 'Failed to save daily reminders' });
    } finally {
      setLoading(false);
    }
  };

  const updateReminder = (index, updates) => {
    setReminders((current) =>
      current.map((reminder, reminderIndex) =>
        reminderIndex === index ? { ...reminder, ...updates } : reminder
      )
    );
  };

  return (
    <main className="relative w-full max-w-[760px] mx-auto pb-28 md:pb-12 space-y-6">
      <title>Daily Reminders – Kharcha</title>

      <header className="relative">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#43189E] transition-colors"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Profile
        </button>
        <h1 className="text-[26px] font-extrabold text-slate-900 tracking-tight mt-4">
          Daily Expense Reminders
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose when Kharcha reminds you and customize each message.
        </p>
        <div className="relative mt-4">
          <div className="w-full h-[1px] bg-slate-200/80" />
          <div className="absolute top-0 left-0 w-12 h-[3px] bg-[#43189E] rounded-full -translate-y-[1px]" />
        </div>
      </header>

      {msg.text && (
        <div
          role="status"
          className={`px-4 py-3 rounded-[18px] text-sm font-semibold border ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 rounded-[24px] border border-slate-100/90 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div>
          <h2 className="font-extrabold text-slate-800">Notifications on this device</h2>
          <p className="text-sm text-slate-500 mt-1">
            Allow Android notifications so reminders can reach you when Kharcha is closed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile/reminders/permission')}
          className="shrink-0 px-4 py-2.5 bg-[#F3E8FF] hover:bg-[#E9D5FF] text-[#6D28D9] font-bold text-sm rounded-[16px] transition-all cursor-pointer"
        >
          Set up notifications
        </button>
      </section>

      <form onSubmit={handleSave} className="space-y-4">
        {reminders.map((reminder, index) => (
          <section
            key={index}
            className="bg-white/80 backdrop-blur-xs rounded-[24px] border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 md:p-6 space-y-4"
          >
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-[14px] bg-[#F3E8FF] flex items-center justify-center text-[#6D28D9]">
                  <Icon name="notifications" className="text-[19px]" />
                </span>
                <span>
                  <span className="block text-base font-extrabold text-slate-800">
                    Reminder {index + 1}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {reminder.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={reminder.enabled}
                onChange={(event) => updateReminder(index, { enabled: event.target.checked })}
                className="h-5 w-5 accent-[#43189E]"
                aria-label={`Enable reminder ${index + 1}`}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <div>
                <label
                  className="text-xs font-bold text-slate-600 block mb-1.5"
                  htmlFor={`reminder-time-${index}`}
                >
                  Reminder time
                </label>
                <input
                  id={`reminder-time-${index}`}
                  type="time"
                  required
                  disabled={!reminder.enabled}
                  value={reminder.time}
                  onChange={(event) => updateReminder(index, { time: event.target.value })}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[16px] px-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-[#43189E] disabled:opacity-50 transition-all"
                />
              </div>

              <div>
                <label
                  className="text-xs font-bold text-slate-600 block mb-1.5"
                  htmlFor={`reminder-message-${index}`}
                >
                  Notification message
                </label>
                <textarea
                  id={`reminder-message-${index}`}
                  required
                  maxLength={140}
                  rows={2}
                  disabled={!reminder.enabled}
                  value={reminder.message}
                  onChange={(event) => updateReminder(index, { message: event.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[16px] p-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-[#43189E] disabled:opacity-50 transition-all resize-none"
                />
                <p className="text-right text-xs text-slate-400 mt-1">
                  {reminder.message.length}/140
                </p>
              </div>
            </div>
          </section>
        ))}

        <p className="text-xs leading-relaxed text-slate-500">
          Reminders use your device&apos;s time zone and stop for the day once you add an expense.
          Push notifications require an internet connection and a running Kharcha server.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="px-5 py-2.5 text-slate-600 font-bold text-sm rounded-[16px] hover:bg-slate-100 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[#43189E] hover:bg-[#381384] text-white font-bold text-sm rounded-[16px] shadow-md shadow-indigo-950/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? 'Saving...' : 'Save Reminders'}
          </button>
        </div>
      </form>
    </main>
  );
};
