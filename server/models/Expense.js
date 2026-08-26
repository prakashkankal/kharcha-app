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

export default mongoose.model('Expense', expenseSchema);
