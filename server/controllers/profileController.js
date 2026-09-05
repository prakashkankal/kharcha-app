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
    const { name, email, theme, monthlyBudget, onboardingCompleted, profileImage } = req.body;
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

    if (onboardingCompleted !== undefined) {
      if (onboardingCompleted !== true && onboardingCompleted !== false) {
        return res.status(400).json({ message: 'Onboarding status must be a boolean' });
      }
      if (!user.settings) user.settings = {};
      user.settings.onboardingCompleted = onboardingCompleted;
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
