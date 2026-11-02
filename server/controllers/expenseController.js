import fs from 'fs';
import path from 'path';
import Expense from '../models/Expense.js';
import Category from '../models/Category.js';
import SplitParticipant from '../models/SplitParticipant.js';
import { uploadFileToDrive } from '../utils/googleDrive.js';
import {
  parseAmount,
  parseTransactionFields,
  validateSplitParticipants,
} from '../utils/transactionValidation.js';

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
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Attach participants if split
    const splitExpenseIds = expenses.filter((e) => e.isSplit).map((e) => e._id);
    if (splitExpenseIds.length > 0) {
      const participants = await SplitParticipant.find({
        expenseId: { $in: splitExpenseIds },
      }).lean();

      const participantsByExpense = {};
      for (const p of participants) {
        if (!participantsByExpense[p.expenseId]) {
          participantsByExpense[p.expenseId] = [];
        }
        participantsByExpense[p.expenseId].push(p);
      }

      for (const exp of expenses) {
        if (exp.isSplit) {
          exp.participants = participantsByExpense[exp._id] || [];
        }
      }
    }

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
      .populate('categoryId', 'name icon')
      .lean();

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.isSplit) {
      expense.participants = await SplitParticipant.find({ expenseId: expense._id }).lean();
    } else {
      expense.participants = [];
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
      isSplit,
      participants,
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

    // Split logic handling
    const splitEnabled = isSplit === true || isSplit === 'true';
    let validatedSplit = null;
    if (splitEnabled) {
      let parsedParticipants = participants;
      if (typeof participants === 'string') {
        try {
          parsedParticipants = JSON.parse(participants);
        } catch {
          return res.status(400).json({ message: 'Invalid participants JSON payload' });
        }
      }

      validatedSplit = validateSplitParticipants(parsedParticipants, parsedAmount, req.user);
      if (validatedSplit.error) {
        return res.status(400).json({ message: validatedSplit.error });
      }
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
      isSplit: splitEnabled,
      date: expenseDate,
    });

    let savedParticipants = [];
    if (splitEnabled && validatedSplit && validatedSplit.participants) {
      try {
        const participantDocs = validatedSplit.participants.map((p) => ({
          expenseId: expense._id,
          userId: req.user._id,
          personName: p.personName,
          participantUserId: p.participantUserId || null,
          isCurrentUser: p.isCurrentUser,
          shareAmount: p.shareAmount,
          shareAmountPaise: p.shareAmountPaise,
          amountPaidBack: p.amountPaidBack || 0,
          amountPaidBackPaise: p.amountPaidBackPaise || 0,
          paymentStatus: (p.amountPaidBackPaise >= p.shareAmountPaise)
            ? 'RECEIVED'
            : (p.amountPaidBackPaise > 0 ? 'PARTIALLY_PAID' : 'PENDING'),
          paymentHistory: p.paymentHistory || [],
        }));

        savedParticipants = await SplitParticipant.insertMany(participantDocs);
      } catch (splitErr) {
        // Rollback expense to prevent orphaned state
        await Expense.deleteOne({ _id: expense._id });
        throw splitErr;
      }
    }

    const populatedExpense = await Expense.findById(expense._id).populate('categoryId', 'name icon').lean();
    populatedExpense.participants = savedParticipants;
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
      isSplit,
      participants,
    } = req.body;

    const expense = await Expense.findOne({ _id: id, userId: req.user._id });
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    let targetAmount = expense.amount;
    if (amount !== undefined) {
      const parsedAmount = parseAmount(amount);
      if (parsedAmount === null) {
        return res.status(400).json({ message: 'Amount must be a positive value with no more than two decimal places' });
      }
      targetAmount = parsedAmount;
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
      if (expense.receiptUrl && expense.receiptUrl.startsWith('/uploads/')) {
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

    // Handle Split updates if provided
    let updatedParticipants = null;
    if (isSplit !== undefined) {
      const splitEnabled = isSplit === true || isSplit === 'true';
      expense.isSplit = splitEnabled;

      if (!splitEnabled) {
        // If turning off split, check if payments exist
        const existingWithPayments = await SplitParticipant.findOne({
          expenseId: expense._id,
          amountPaidBackPaise: { $gt: 0 },
        });
        if (existingWithPayments) {
          return res.status(400).json({
            message: 'Cannot disable split for an expense that already has recorded payments',
          });
        }
        await SplitParticipant.deleteMany({ expenseId: expense._id });
      } else if (participants !== undefined) {
        let parsedParticipants = participants;
        if (typeof participants === 'string') {
          try {
            parsedParticipants = JSON.parse(participants);
          } catch {
            return res.status(400).json({ message: 'Invalid participants JSON payload' });
          }
        }

        const validatedSplit = validateSplitParticipants(parsedParticipants, targetAmount, req.user);
        if (validatedSplit.error) {
          return res.status(400).json({ message: validatedSplit.error });
        }

        // Fetch existing participants to ensure payment history is preserved safely
        const existingParticipants = await SplitParticipant.find({ expenseId: expense._id });
        const existingMap = new Map();
        for (const ep of existingParticipants) {
          existingMap.set(String(ep._id), ep);
          existingMap.set(ep.personName.toLowerCase(), ep);
        }

        // Check if any previously received amount exceeds new share amount
        for (const p of validatedSplit.participants) {
          const match = (p._id && existingMap.get(String(p._id))) || existingMap.get(p.personName.toLowerCase());
          if (match && match.amountPaidBackPaise > p.shareAmountPaise) {
            return res.status(400).json({
              message: `Participant "${p.personName}" has already paid ₹${(match.amountPaidBackPaise / 100).toFixed(2)}, which exceeds their new share amount ₹${p.shareAmount.toFixed(2)}`,
            });
          }
        }

        // Re-create or update participants preserving payments
        const finalParticipantDocs = validatedSplit.participants.map((p) => {
          const match = (p._id && existingMap.get(String(p._id))) || existingMap.get(p.personName.toLowerCase());
          const paidPaise = match ? match.amountPaidBackPaise : (p.amountPaidBackPaise || 0);
          const history = match ? match.paymentHistory : (p.paymentHistory || []);

          let status = 'PENDING';
          if (paidPaise >= p.shareAmountPaise && p.shareAmountPaise > 0) {
            status = 'RECEIVED';
          } else if (paidPaise > 0) {
            status = 'PARTIALLY_PAID';
          }

          return {
            _id: match ? match._id : undefined,
            expenseId: expense._id,
            userId: req.user._id,
            personName: p.personName,
            participantUserId: p.participantUserId || (p.isCurrentUser ? req.user._id : null),
            isCurrentUser: p.isCurrentUser,
            shareAmount: p.shareAmount,
            shareAmountPaise: p.shareAmountPaise,
            amountPaidBack: paidPaise / 100,
            amountPaidBackPaise: paidPaise,
            paymentStatus: status,
            paymentHistory: history,
          };
        });

        await SplitParticipant.deleteMany({ expenseId: expense._id });
        updatedParticipants = await SplitParticipant.insertMany(finalParticipantDocs);
      }
    }

    await expense.save();
    const populatedExpense = await Expense.findById(expense._id).populate('categoryId', 'name icon').lean();
    if (populatedExpense.isSplit) {
      populatedExpense.participants = updatedParticipants || (await SplitParticipant.find({ expenseId: expense._id }).lean());
    } else {
      populatedExpense.participants = [];
    }

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

    if (expense.receiptUrl && expense.receiptUrl.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), expense.receiptUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Cascade delete any split participants linked to this expense
    await SplitParticipant.deleteMany({ expenseId: expense._id });
    await expense.deleteOne();

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending receivables for the authenticated user
 * Outstanding Amount = Share Amount - Amount Already Received
 * Excludes user's own share (isCurrentUser === true)
 * Excludes fully paid participants (Outstanding === 0)
 */
export const getPendingReceivables = async (req, res, next) => {
  try {
    const participants = await SplitParticipant.find({
      userId: req.user._id,
      isCurrentUser: { $ne: true },
      paymentStatus: { $ne: 'RECEIVED' },
    })
      .populate('expenseId', 'description date categoryId amount')
      .sort({ createdAt: -1 })
      .lean();

    // Filter to those with actual outstanding balance
    const validReceivables = [];
    let totalOutstandingPaise = 0;

    for (const p of participants) {
      if (!p.expenseId) continue; // orphaned or deleted expense
      const outstandingPaise = (p.shareAmountPaise || Math.round(p.shareAmount * 100)) - (p.amountPaidBackPaise || Math.round((p.amountPaidBack || 0) * 100));
      if (outstandingPaise > 0) {
        totalOutstandingPaise += outstandingPaise;
        validReceivables.push({
          ...p,
          outstandingAmount: outstandingPaise / 100,
          outstandingAmountPaise: outstandingPaise,
        });
      }
    }

    res.json({
      totalReceivable: totalOutstandingPaise / 100,
      totalReceivablePaise: totalOutstandingPaise,
      receivables: validReceivables,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record a full or partial payment from a split participant
 */
export const recordParticipantPayment = async (req, res, next) => {
  try {
    const { participantId } = req.params;
    const { amount, notes } = req.body;

    const participant = await SplitParticipant.findOne({
      _id: participantId,
      userId: req.user._id,
    });

    if (!participant) {
      return res.status(404).json({ message: 'Participant record not found' });
    }

    if (participant.isCurrentUser) {
      return res.status(400).json({ message: 'Cannot record receivable payments for user\'s own share' });
    }

    const sharePaise = participant.shareAmountPaise || Math.round(participant.shareAmount * 100);
    const alreadyPaidPaise = participant.amountPaidBackPaise || Math.round(participant.amountPaidBack * 100);
    const outstandingPaise = sharePaise - alreadyPaidPaise;

    if (outstandingPaise <= 0) {
      return res.status(400).json({ message: 'This participant has already settled their full share' });
    }

    // Default to paying full outstanding if amount is omitted
    const payRupees = amount !== undefined ? Number(amount) : (outstandingPaise / 100);
    const payPaise = Math.round(payRupees * 100);

    if (!Number.isFinite(payRupees) || payPaise <= 0 || Math.abs(payPaise - payRupees * 100) > 1e-7) {
      return res.status(400).json({ message: 'Payment amount must be a positive number with at most 2 decimal places' });
    }

    if (payPaise > outstandingPaise) {
      return res.status(400).json({
        message: `Payment amount ₹${(payPaise / 100).toFixed(2)} exceeds outstanding balance ₹${(outstandingPaise / 100).toFixed(2)}`,
      });
    }

    const newPaidBackPaise = alreadyPaidPaise + payPaise;
    participant.amountPaidBackPaise = newPaidBackPaise;
    participant.amountPaidBack = newPaidBackPaise / 100;

    if (newPaidBackPaise >= sharePaise) {
      participant.paymentStatus = 'RECEIVED';
    } else {
      participant.paymentStatus = 'PARTIALLY_PAID';
    }

    participant.paymentHistory.push({
      amount: payPaise / 100,
      amountPaise: payPaise,
      date: new Date(),
      notes: notes || '',
    });

    await participant.save();

    res.json({
      message: 'Payment recorded successfully',
      participant,
      outstandingAmount: (sharePaise - newPaidBackPaise) / 100,
    });
  } catch (error) {
    next(error);
  }
};
