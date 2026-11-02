import User from '../models/User.js';

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      email,
      theme,
      monthlyBudget,
      openingCashBalance,
      openingBankBalance,
      onboardingCompleted,
      notifications,
      profileImage,
    } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: 'This email is already in use' });
      }
      user.email = email.toLowerCase();
    }

    if (theme && ['light', 'dark', 'system'].includes(theme)) {
      if (!user.settings) user.settings = {};
      user.settings.theme = theme;
    }

    if (monthlyBudget !== undefined) {
      const parsedBudget = Number(monthlyBudget);
      if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
        return res.status(400).json({ message: 'Monthly budget must be a valid non-negative number' });
      }
      if (!user.settings) user.settings = {};
      user.settings.monthlyBudget = parsedBudget;
    }

    for (const [field, value] of Object.entries({ openingCashBalance, openingBankBalance })) {
      if (value !== undefined) {
        const parsedBalance = Number(value);
        if (!Number.isFinite(parsedBalance) || parsedBalance < 0 || Math.abs(Math.round(parsedBalance * 100) - parsedBalance * 100) > 1e-7) {
          return res.status(400).json({ message: 'Opening balances must be valid non-negative amounts with no more than two decimal places' });
        }
        if (!user.settings) user.settings = {};
        user.settings[field] = parsedBalance;
      }
    }

    if (onboardingCompleted !== undefined) {
      if (onboardingCompleted !== true && onboardingCompleted !== false) {
        return res.status(400).json({ message: 'Onboarding status must be a boolean' });
      }
      if (!user.settings) user.settings = {};
      user.settings.onboardingCompleted = onboardingCompleted;
    }

    if (notifications !== undefined) {
      if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) {
        return res.status(400).json({ message: 'Please provide valid reminder settings' });
      }

      const currentNotifications = user.settings?.notifications || {};
      const timeZone = notifications.timezone ?? currentNotifications.timezone ?? 'Asia/Kolkata';
      const reminders =
        notifications.reminders ??
        (typeof notifications.enabled === 'boolean'
          ? [
              {
                enabled: notifications.enabled,
                time: notifications.time ?? currentNotifications.time ?? '21:00',
                message:
                  notifications.message ??
                  currentNotifications.message ??
                  "Don't forget to add today's expenses in Kharcha!",
              },
              { enabled: false, time: '18:00', message: 'Have you added your afternoon expenses?' },
              { enabled: false, time: '21:00', message: "Don't forget to log today's expenses before the day ends!" },
            ]
          : undefined);

      if (
        !Array.isArray(reminders) ||
        reminders.length !== 3 ||
        reminders.some(
          (reminder) =>
            !reminder ||
            typeof reminder.enabled !== 'boolean' ||
            typeof reminder.time !== 'string' ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder.time) ||
            typeof reminder.message !== 'string' ||
            !reminder.message.trim() ||
            reminder.message.trim().length > 140
        ) ||
        typeof timeZone !== 'string' ||
        timeZone.length > 100
      ) {
        return res.status(400).json({ message: 'Please provide valid reminder settings' });
      }

      try {
        new Intl.DateTimeFormat('en-US', { timeZone });
      } catch {
        return res.status(400).json({ message: 'Please provide a valid reminder time zone' });
      }

      if (!user.settings) user.settings = {};
      user.settings.notifications = {
        enabled: reminders.some((reminder) => reminder.enabled),
        time: reminders[0].time,
        message: reminders[0].message.trim(),
        timezone: timeZone,
        reminders: reminders.map((reminder) => ({
          enabled: reminder.enabled,
          time: reminder.time,
          message: reminder.message.trim(),
        })),
      };
    }

    if (profileImage !== undefined) {
      user.profileImage = profileImage;
    }

    if (req.file) {
      user.profileImage = `/uploads/${req.file.filename}`;
    }

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      settings: user.settings,
    });
  } catch (error) {
    next(error);
  }
};
