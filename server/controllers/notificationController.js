import PushSubscription from '../models/PushSubscription.js';

const isPushConfigured = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

const isValidPushEndpoint = (endpoint) => {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    const supportedHosts = [
      'fcm.googleapis.com',
      'push.services.mozilla.com',
      'push.apple.com',
      'notify.windows.com',
      'push.services.opera.com',
      'push.samsung.com',
    ];

    return (
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      supportedHosts.some((supportedHost) => host === supportedHost || host.endsWith(`.${supportedHost}`))
    );
  } catch {
    return false;
  }
};

export const getPublicKey = (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ message: 'Push notifications are not configured on the server' });
  }
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

export const saveSubscription = async (req, res, next) => {
  try {
    const { endpoint, keys, expirationTime } = req.body || {};
    if (
      typeof endpoint !== 'string' ||
      endpoint.length > 2048 ||
      !isValidPushEndpoint(endpoint) ||
      !keys ||
      typeof keys.p256dh !== 'string' ||
      typeof keys.auth !== 'string' ||
      !keys.p256dh ||
      !keys.auth ||
      keys.p256dh.length > 256 ||
      keys.auth.length > 256 ||
      (expirationTime !== null && expirationTime !== undefined && !Number.isFinite(expirationTime))
    ) {
      return res.status(400).json({ message: 'A valid push subscription is required' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId: req.user._id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        expirationTime: expirationTime ?? null,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ message: 'Push subscription saved' });
  } catch (error) {
    return next(error);
  }
};

export const removeSubscription = async (req, res, next) => {
  try {
    const { endpoint } = req.body || {};
    if (typeof endpoint !== 'string' || endpoint.length > 2048) {
      return res.status(400).json({ message: 'A valid push subscription endpoint is required' });
    }

    await PushSubscription.deleteOne({ userId: req.user._id, endpoint });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
};
