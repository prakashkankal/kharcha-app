import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    amountPaise: {
      type: Number,
      min: [1, 'Amount must be greater than 0'],
    },
    transactionType: {
      type: String,
      enum: ['expense', 'income', 'transfer'],
      default: 'expense',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'card', 'other'],
      default: 'other',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'success', 'failed', 'cancelled', 'unknown'],
      default: 'success',
      index: true,
    },
    fromWallet: {
      type: String,
      enum: ['cash', 'bank'],
    },
    toWallet: {
      type: String,
      enum: ['cash', 'bank'],
    },
    merchantName: {
      type: String,
      trim: true,
      default: '',
    },
    merchantUpiId: {
      type: String,
      trim: true,
      default: '',
    },
    externalTransactionReference: {
      type: String,
      trim: true,
      default: '',
    },
    selectedPaymentApp: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    receiptUrl: {
      type: String,
      default: null,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

expenseSchema.pre('validate', function setAmountPaise() {
  if (Number.isFinite(this.amount)) {
    this.amountPaise = Math.round(this.amount * 100);
  }
});

export default mongoose.model('Expense', expenseSchema);
