import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { notificationApi } from '../services/notificationApi';

const getPermission = () =>
  'Notification' in window ? Notification.permission : 'unsupported';

export const NotificationPermission = () => {
  const navigate = useNavigate();
  const [permission, setPermission] = useState(getPermission);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAllowNotifications = async () => {
    setError('');
    const currentPermission = getPermission();
    setPermission(currentPermission);

    if (currentPermission === 'denied') {
      setError('Notifications are still blocked. Allow them in Android settings, then check again.');
      return;
    }

    setLoading(true);

    try {
      await notificationApi.subscribe();
      setPermission(getPermission());
    } catch (requestError) {
      setPermission(getPermission());
      setError(requestError.message || 'Could not enable notifications.');
    } finally {
      setLoading(false);
    }
  };

  const unsupported = permission === 'unsupported';
  const denied = permission === 'denied';

  return (
    <main className="relative w-full max-w-[640px] mx-auto pb-28 md:pb-12 space-y-6">
      <title>Enable Notifications – Kharcha</title>

      <header className="relative">
        <button
          type="button"
          onClick={() => navigate('/profile/reminders')}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#43189E] transition-colors"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Daily Reminders
        </button>
        <h1 className="text-[26px] font-extrabold text-slate-900 tracking-tight mt-4">
          Allow notifications
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Let Kharcha remind you to record your expenses, even when the app is closed.
        </p>
        <div className="relative mt-4">
          <div className="w-full h-[1px] bg-slate-200/80" />
          <div className="absolute top-0 left-0 w-12 h-[3px] bg-[#43189E] rounded-full -translate-y-[1px]" />
        </div>
      </header>

      <section className="bg-white/80 rounded-[24px] border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[16px] bg-[#F3E8FF] flex items-center justify-center text-[#6D28D9] shrink-0">
            <Icon name="notifications" className="text-[23px]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800">
              {permission === 'granted'
                ? 'Notifications are allowed'
                : denied
                  ? 'Notifications are blocked'
                  : unsupported
                    ? 'Notifications are unavailable'
                    : 'Turn on Kharcha notifications'}
            </h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              {permission === 'granted'
                ? 'This device can receive your scheduled expense reminders.'
                : denied
                  ? 'Allow notifications for Kharcha in your Android or browser settings, then return here.'
                  : unsupported
                    ? 'Use a supported Android browser and open Kharcha over a secure HTTPS connection.'
                    : 'Tap the button below. When Android asks, choose Allow.'}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-[16px] bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleAllowNotifications}
          disabled={loading || unsupported}
          className="w-full h-12 bg-[#43189E] hover:bg-[#381384] text-white font-bold text-sm rounded-[16px] shadow-md shadow-indigo-950/20 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
        >
          {loading
            ? 'Requesting permission...'
            : permission === 'granted'
              ? 'Enable on this device'
              : denied
                ? 'Check permission again'
                : unsupported
                  ? 'Not supported'
                  : 'Allow notifications'}
        </button>

        {denied && (
          <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1.5">
            <li>Open Android Settings and find Kharcha or the browser you use.</li>
            <li>Open App notifications and allow notifications.</li>
            <li>For Chrome, also check Site settings → Notifications for this website.</li>
            <li>Return to Kharcha and tap “Enable on this device”.</li>
          </ol>
        )}

        <p className="text-xs leading-relaxed text-slate-500">
          Notifications require internet access and the Kharcha server to be running. You can manage
          reminder times and messages on the Daily Reminders page.
        </p>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/profile/reminders')}
          className="px-5 py-2.5 text-slate-600 font-bold text-sm rounded-[16px] hover:bg-slate-100 transition-all cursor-pointer"
        >
          Back to reminders
        </button>
      </div>
    </main>
  );
};
