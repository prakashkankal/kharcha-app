import Expense from '../models/Expense.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import SplitParticipant from '../models/SplitParticipant.js';

export const exportData = async (req, res, next) => {
  try {
    const categories = await Category.find({ userId: req.user._id });
    const expenses = await Expense.find({ userId: req.user._id }).populate('categoryId', 'name icon');
    const participants = await SplitParticipant.find({ userId: req.user._id });

    const backupPayload = {
      app: 'Kharcha',
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      user: {
        name: req.user.name,
        email: req.user.email,
      },
      settings: {
        monthlyBudget: req.user.settings?.monthlyBudget || 0,
        openingCashBalance: req.user.settings?.openingCashBalance || 0,
        openingBankBalance: req.user.settings?.openingBankBalance || 0,
      },
      categories: categories.map((c) => ({
        id: c._id,
        name: c.name,
        icon: c.icon,
      })),
      expenses: expenses.map((e) => ({
        id: e._id,
        amount: e.amount,
        category: e.categoryId ? e.categoryId.name : 'Other',
        description: e.description,
        date: e.date,
        receiptUrl: e.receiptUrl,
        transactionType: e.transactionType || 'expense',
        paymentMethod: e.paymentMethod || 'other',
        paymentStatus: e.paymentStatus || 'success',
        fromWallet: e.fromWallet || '',
        toWallet: e.toWallet || '',
        merchantName: e.merchantName || '',
        merchantUpiId: e.merchantUpiId || '',
        externalTransactionReference: e.externalTransactionReference || '',
        selectedPaymentApp: e.selectedPaymentApp || '',
        isSplit: Boolean(e.isSplit),
      })),
      splitParticipants: participants.map((p) => ({
        id: p._id,
        expenseId: p.expenseId,
        personName: p.personName,
        participantUserId: p.participantUserId,
        isCurrentUser: p.isCurrentUser,
        shareAmount: p.shareAmount,
        amountPaidBack: p.amountPaidBack,
        paymentStatus: p.paymentStatus,
        paymentHistory: p.paymentHistory,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=kharcha-backup-${Date.now()}.json`);
    res.json(backupPayload);
  } catch (error) {
    next(error);
  }
};

export const importData = async (req, res, next) => {
  try {
    const { expenses, categories, settings, splitParticipants } = req.body;

    if (!Array.isArray(expenses)) {
      return res.status(400).json({ message: 'Invalid backup format: expenses array required' });
    }

    const settingUpdates = {};
    for (const field of ['monthlyBudget', 'openingCashBalance', 'openingBankBalance']) {
      if (settings?.[field] !== undefined) {
        const value = Number(settings[field]);
        if (
          !Number.isFinite(value) ||
          value < 0 ||
          Math.abs(Math.round(value * 100) - value * 100) > 1e-7
        ) {
          return res.status(400).json({ message: `Invalid backup value for ${field}` });
        }
        settingUpdates[`settings.${field}`] = value;
      }
    }
    // Map categories or seed missing ones
    const categoryMap = new Map();
    const existingCats = await Category.find({ userId: req.user._id });
    existingCats.forEach((c) => categoryMap.set(c.name.toLowerCase(), c._id));

    if (Array.isArray(categories)) {
      for (const cat of categories) {
        if (cat.name && !categoryMap.has(cat.name.toLowerCase())) {
          const newCat = await Category.create({
            userId: req.user._id,
            name: cat.name,
            icon: cat.icon || '📦',
          });
          categoryMap.set(newCat.name.toLowerCase(), newCat._id);
        }
      }
    }

    let defaultCatId = categoryMap.get('other');
    if (!defaultCatId) {
      const fallbackCat = await Category.create({
        userId: req.user._id,
        name: 'Other',
        icon: '📦',
      });
      defaultCatId = fallbackCat._id;
    }

    let importedCount = 0;
    const oldExpenseIdToNew = new Map();

    for (const exp of expenses) {
      if (exp.amount && exp.date) {
        const catName = exp.category ? exp.category.toLowerCase() : 'other';
        const categoryId = categoryMap.get(catName) || defaultCatId;

        const created = await Expense.create({
          userId: req.user._id,
          categoryId,
          amount: parseFloat(exp.amount),
          transactionType: exp.transactionType || 'expense',
          paymentMethod: exp.paymentMethod || 'other',
          paymentStatus: exp.paymentStatus || 'success',
          fromWallet: exp.fromWallet || undefined,
          toWallet: exp.toWallet || undefined,
          description: exp.description || '',
          merchantName: exp.merchantName || '',
          merchantUpiId: exp.merchantUpiId || '',
          externalTransactionReference: exp.externalTransactionReference || '',
          selectedPaymentApp: exp.selectedPaymentApp || '',
          receiptUrl: exp.receiptUrl || null,
          isSplit: Boolean(exp.isSplit),
          date: new Date(exp.date),
        });
        if (exp.id) {
          oldExpenseIdToNew.set(String(exp.id), created._id);
        }
        importedCount++;
      }
    }

    if (Array.isArray(splitParticipants)) {
      for (const sp of splitParticipants) {
        const newExpenseId = oldExpenseIdToNew.get(String(sp.expenseId));
        if (newExpenseId && sp.personName && sp.shareAmount) {
          const sharePaise = Math.round(Number(sp.shareAmount) * 100);
          const paidPaise = Math.round(Number(sp.amountPaidBack || 0) * 100);
          await SplitParticipant.create({
            expenseId: newExpenseId,
            userId: req.user._id,
            personName: sp.personName,
            participantUserId: sp.participantUserId || null,
            isCurrentUser: Boolean(sp.isCurrentUser),
            shareAmount: Number(sp.shareAmount),
            shareAmountPaise: sharePaise,
            amountPaidBack: paidPaise / 100,
            amountPaidBackPaise: paidPaise,
            paymentStatus: (paidPaise >= sharePaise) ? 'RECEIVED' : (paidPaise > 0 ? 'PARTIALLY_PAID' : 'PENDING'),
            paymentHistory: Array.isArray(sp.paymentHistory) ? sp.paymentHistory : [],
          });
        }
      }
    }

    if (Object.keys(settingUpdates).length > 0) {
      await User.updateOne({ _id: req.user._id }, { $set: settingUpdates });
    }

    res.json({ message: `Successfully imported ${importedCount} expenses.` });
  } catch (error) {
    next(error);
  }
};

export const clearAllData = async (req, res, next) => {
  try {
    const { confirm } = req.body;
    if (!confirm) {
      return res.status(400).json({ message: 'Confirmation is required to delete all user data' });
    }

    await SplitParticipant.deleteMany({ userId: req.user._id });
    await Expense.deleteMany({ userId: req.user._id });
    res.json({ message: 'All expense data has been deleted permanently.' });
  } catch (error) {
    next(error);
  }
};
