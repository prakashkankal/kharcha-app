import fs from 'fs';
import path from 'path';
import Expense from '../models/Expense.js';
import Category from '../models/Category.js';
import { uploadFileToDrive } from '../utils/googleDrive.js';
import { parseAmount, parseTransactionFields } from '../utils/transactionValidation.js';

export const getExpenses = async (req, res, next) => {
  try {
    const { month, categoryId } = req.query;
    const query = { userId: req.user._id };

    if (categoryId) {
      query.categoryId = categoryId;
    }
    if (month) {
      // month format: YYYY-MM
      const [year, m] = month.split('-').map(Number);
      if (year && m) {
        const startDate = new Date(Date.UTC(year, m - 1, 1));
        const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
        query.date = { $gte: startDate, $lte: endDate };
      }
    }

    const expenses = await Expense.find(query)
      .populate('categoryId', 'name icon')
      .sort({ date: -1, createdAt: -1 });

    res.json(expenses);
  } catch (error) {
    next(error);
  }
};

export const getMonthlySummary = async (req, res, next) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const [year, m] = targetMonth.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));

    const result = await Expense.aggregate([
      {
        $match: {
          userId: req.user._id,
          date: { $gte: startDate, $lte: endDate },
          $and: [
            { $or: [{ transactionType: 'expense' }, { transactionType: { $exists: false } }] },
            { $or: [{ paymentStatus: 'success' }, { paymentStatus: { $exists: false } }] },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalPaise: {
            $sum: {
              $ifNull: ['$amountPaise', { $round: [{ $multiply: ['$amount', 100] }, 0] }],
            },
          },
        },
      },
    ]);

    const total = result.length > 0 ? result[0].totalPaise / 100 : 0;
    res.json({ month: targetMonth, total });
  } catch (error) {
    next(error);
  }
};

export const getExpenseById = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('categoryId', 'name icon');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    next(error);
  }
};

export const createExpense = async (req, res, next) => {
  try {
    const {
      amount,
      categoryId,
      description,
      date,
      merchantName,
      merchantUpiId,
      externalTransactionReference,
      selectedPaymentApp,
    } = req.body;

    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null) {
      return res.status(400).json({ message: 'Amount must be a positive value with no more than two decimal places' });
    }

    if (!categoryId) {
      return res.status(400).json({ message: 'Category is required' });
    }

    const transactionFields = parseTransactionFields(req.body);
    if (transactionFields.error) {
      return res.status(400).json({ message: transactionFields.error });
    }
    const categoryExists = await Category.findOne({ _id: categoryId, userId: req.user._id });
    if (!categoryExists) {
      return res.status(400).json({ message: 'Invalid category selected' });
    }

    let receiptUrl = null;
    if (req.file) {
      const categoryName = categoryExists?.name || 'General';
      const driveUrl = await uploadFileToDrive(req.file.path, req.file.originalname, req.file.mimetype, req.user, categoryName);
      receiptUrl = driveUrl || `/uploads/${req.file.filename}`;
    }

    const expenseDate = date ? new Date(date) : new Date();

    const expense = await Expense.create({
      userId: req.user._id,
      categoryId,
      amount: parsedAmount,
      ...transactionFields,
      description: description || '',
      merchantName: merchantName || '',
      merchantUpiId: merchantUpiId || '',
      externalTransactionReference: externalTransactionReference || '',
      selectedPaymentApp: selectedPaymentApp || '',
      receiptUrl,
      date: expenseDate,
    });

    const populatedExpense = await Expense.findById(expense._id).populate('categoryId', 'name icon');
    res.status(201).json(populatedExpense);
  } catch (error) {
    next(error);
  }
};

export const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      amount,
      categoryId,
      description,
      date,
      removeReceipt,
      transactionType,
      paymentMethod,
      paymentStatus,
      fromWallet,
      toWallet,
      merchantName,
      merchantUpiId,
      externalTransactionReference,
      selectedPaymentApp,
    } = req.body;

    const expense = await Expense.findOne({ _id: id, userId: req.user._id });
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (amount !== undefined) {
      const parsedAmount = parseAmount(amount);
      if (parsedAmount === null) {
        return res.status(400).json({ message: 'Amount must be a positive value with no more than two decimal places' });
      }
      expense.amount = parsedAmount;
    }

    const transactionFields = parseTransactionFields(
      { transactionType, paymentMethod, paymentStatus, fromWallet, toWallet },
      { defaults: false }
    );
    if (transactionFields.error) {
      return res.status(400).json({ message: transactionFields.error });
    }
    for (const [field, value] of Object.entries(transactionFields)) {
      if (value !== undefined) expense[field] = value;
    }

    if (merchantName !== undefined) expense.merchantName = merchantName;
    if (merchantUpiId !== undefined) expense.merchantUpiId = merchantUpiId;
    if (externalTransactionReference !== undefined) expense.externalTransactionReference = externalTransactionReference;
    if (selectedPaymentApp !== undefined) expense.selectedPaymentApp = selectedPaymentApp;
    let categoryObj = null;
    if (categoryId) {
      categoryObj = await Category.findOne({ _id: categoryId, userId: req.user._id });
      if (!categoryObj) {
        return res.status(400).json({ message: 'Invalid category selected' });
      }
      expense.categoryId = categoryId;
    }

    if (description !== undefined) {
      expense.description = description;
    }

    if (date !== undefined) {
      expense.date = new Date(date);
    }

    if (removeReceipt === 'true' || removeReceipt === true) {
      if (expense.receiptUrl) {
        const filePath = path.join(process.cwd(), expense.receiptUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        expense.receiptUrl = null;
      }
    }

    if (req.file) {
      // Unlink old receipt if replacing local file
      if (expense.receiptUrl && expense.receiptUrl.startsWith('/uploads/')) {
        const oldPath = path.join(process.cwd(), expense.receiptUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Resolve category name for drive folder
      let catName = 'General';
      if (categoryObj) {
        catName = categoryObj.name;
      } else if (expense.categoryId) {
        const existingCat = await Category.findById(expense.categoryId);
        if (existingCat) catName = existingCat.name;
      }

      const driveUrl = await uploadFileToDrive(req.file.path, req.file.originalname, req.file.mimetype, req.user, catName);
      expense.receiptUrl = driveUrl || `/uploads/${req.file.filename}`;
    }

    await expense.save();
    const populatedExpense = await Expense.findById(expense._id).populate('categoryId', 'name icon');
    res.json(populatedExpense);
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findOne({ _id: id, userId: req.user._id });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.receiptUrl) {
      const filePath = path.join(process.cwd(), expense.receiptUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await expense.deleteOne();
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
};
