import mongoose from 'mongoose';

const splitParticipantSchema = new mongoose.Schema(
  {
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    personName: {
      type: String,
      required: [true, 'Participant name is required'],
      trim: true,
    },
    participantUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isCurrentUser: {
      type: Boolean,
      default: false,
    },
    shareAmount: {
      type: Number,
      required: [true, 'Share amount is required'],
      min: [0.01, 'Share amount must be greater than 0'],
    },
    shareAmountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    amountPaidBack: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountPaidBackPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIALLY_PAID', 'RECEIVED'],
      default: 'PENDING',
      index: true,
    },
    paymentHistory: [
      {
        amount: {
          type: Number,
          required: true,
          min: 0.01,
        },
        amountPaise: {
          type: Number,
          required: true,
          min: 1,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          default: '',
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

splitParticipantSchema.pre('validate', function calculatePaiseAndStatus() {
  if (Number.isFinite(this.shareAmount)) {
    this.shareAmountPaise = Math.round(this.shareAmount * 100);
  }
  if (Number.isFinite(this.amountPaidBack)) {
    this.amountPaidBackPaise = Math.round(this.amountPaidBack * 100);
  }

  // Derive status based on paise amounts
  const share = this.shareAmountPaise || 0;
  const paid = this.amountPaidBackPaise || 0;

  if (paid >= share && share > 0) {
    this.paymentStatus = 'RECEIVED';
  } else if (paid > 0) {
    this.paymentStatus = 'PARTIALLY_PAID';
  } else {
    this.paymentStatus = 'PENDING';
  }
});

export default mongoose.model('SplitParticipant', splitParticipantSchema);

