import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    expirationTime: {
      type: Number,
      default: null,
    },
    lastNotifiedDate: {
      type: String,
      default: '',
    },
    lastNotifiedReminder1Date: {
      type: String,
      default: '',
    },
    lastNotifiedReminder2Date: {
      type: String,
      default: '',
    },
    lastNotifiedReminder3Date: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
