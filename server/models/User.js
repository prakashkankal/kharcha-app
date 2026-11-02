import mongoose from 'mongoose';

const DEFAULT_NOTIFICATION_REMINDERS = [
  { enabled: true, time: '12:00', message: 'Had your lunch? Log your expense on Kharcha' },
  { enabled: true, time: '18:00', message: 'Have you added your afternoon expenses?' },
  { enabled: true, time: '21:00', message: 'Dinner time! Record your food expenses on Kharcha' },
];

const notificationReminderSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },
    time: {
      type: String,
      default: '21:00',
    },
    message: {
      type: String,
      default: 'Don\'t forget to add today\'s expenses in Kharcha!',
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
    },
    googleAccessToken: {
      type: String,
      default: null,
    },
    googleRefreshToken: {
      type: String,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    resetPasswordOtp: {
      type: String,
      default: null,
    },
    resetPasswordOtpExpiresAt: {
      type: Date,
      default: null,
    },
    settings: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'light',
      },
      monthlyBudget: {
        type: Number,
        min: 0,
        default: 0,
      },
      openingCashBalance: {
        type: Number,
        min: 0,
        default: 0,
      },
      openingBankBalance: {
        type: Number,
        min: 0,
        default: 0,
      },
      onboardingCompleted: {
        type: Boolean,
        default: true,
      },
      notifications: {
        enabled: {
          type: Boolean,
          default: true,
        },
        time: {
          type: String,
          default: '21:00',
        },
        message: {
          type: String,
          default: 'Don\'t forget to add today\'s expenses in Kharcha!',
        },
        timezone: {
          type: String,
          default: 'Asia/Kolkata',
        },
        reminders: {
          type: [notificationReminderSchema],
          default: () => DEFAULT_NOTIFICATION_REMINDERS.map((reminder) => ({ ...reminder })),
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('User', userSchema);
