import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    icon: {
      type: String,
      default: '📦',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness of category name per user
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);
