import { apiFetch } from './api';

const decodeVapidKey = (key) => {
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = `${key}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
};

const getPushManager = async () => {
  if (
    !window.isSecureContext ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    throw new Error('Push reminders are not supported by this browser or connection.');
  }

  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;

  if (permission !== 'granted') {
    throw new Error('Allow notifications in your browser settings to enable reminders.');
  }

  return navigator.serviceWorker.ready;
};

export const notificationApi = {
  subscribe: async () => {
    const registration = await getPushManager();
    const { publicKey } = await apiFetch('/notifications/public-key');
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
    }

    await apiFetch('/notifications/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscription.toJSON()),
    });
  },

  unsubscribe: async () => {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await apiFetch('/notifications/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  },
};
