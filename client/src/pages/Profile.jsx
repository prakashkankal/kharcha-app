import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { profileApi } from '../services/profileApi';
import { backupApi } from '../services/backupApi';

const getInitials = (name) => {
  if (!name) return 'PK';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { theme, changeTheme } = useTheme();

  // Modals
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);

  // Form states
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [monthlyBudget, setMonthlyBudget] = useState(user?.settings?.monthlyBudget || '');
  const [openingCashBalance, setOpeningCashBalance] = useState(user?.settings?.openingCashBalance || 0);
  const [openingBankBalance, setOpeningBankBalance] = useState(user?.settings?.openingBankBalance || 0);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', editName);
      formData.append('email', editEmail);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const updated = await profileApi.updateProfile(formData);
      updateUser(updated);
      setShowEditProfile(false);
      setMsg({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setLoading(true);

    try {
      const updated = await profileApi.updateProfile({
        monthlyBudget: Number(monthlyBudget) || 0,
        openingCashBalance: Number(openingCashBalance) || 0,
        openingBankBalance: Number(openingBankBalance) || 0,
      });
      updateUser(updated);
      setShowBudgetModal(false);
      setMsg({ type: 'success', text: 'Monthly budget updated successfully' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update monthly budget' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = await backupApi.exportData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `kharcha-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMsg({ type: 'success', text: 'Data exported successfully!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Export failed' });
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const res = await backupApi.importData(json);
        setMsg({ type: 'success', text: res.message || 'Data imported successfully' });
        setShowBackupModal(false);
      } catch {
        setMsg({ type: 'error', text: 'Failed to import: invalid JSON backup format' });
      }
    };
    reader.readAsText(file);
  };

  const handleClearAllData = async () => {
    setLoading(true);
    try {
      const res = await backupApi.clearAllData();
      setMsg({ type: 'success', text: res.message });
      setShowClearDataConfirm(false);
      setShowBackupModal(false);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Clear data failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-[1024px] mx-auto pb-28 md:pb-12 space-y-6">
      <title>Profile – Kharcha</title>

      {/* Top ambient glow */}
      <div className="absolute -top-12 -right-8 w-64 h-64 bg-purple-200/35 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header with Title and Accent Underline */}
      <div className="relative mb-6">
        <h1 className="text-[26px] font-extrabold text-slate-900 tracking-tight">
          Profile
        </h1>
        <div className="relative mt-2">
          <div className="w-full h-[1px] bg-slate-200/80" />
          <div className="absolute top-0 left-0 w-12 h-[3px] bg-[#43189E] rounded-full -translate-y-[1px]" />
        </div>
      </div>

      {/* Alert Messages */}
      {msg.text && (
        <div
          className={`px-4 py-3 rounded-[18px] text-sm font-semibold flex items-center justify-between border shadow-2xs ${
            msg.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          <span>{msg.text}</span>
          <button
            type="button"
            onClick={() => setMsg({ type: '', text: '' })}
            className="text-xs font-bold px-1.5 py-0.5 rounded-full hover:bg-black/5"
          >
            ✕
          </button>
        </div>
      )}

      {/* User Info Section (Matching Screenshot) */}
      <section className="flex items-center gap-5 my-6">
        {/* Large Circular Avatar with Deep Purple Gradient */}
        <div className="relative w-22 h-22 md:w-24 md:h-24 rounded-full overflow-hidden shrink-0 shadow-lg shadow-purple-950/15 flex items-center justify-center bg-gradient-to-br from-[#2D0B6B] via-[#3B0764] to-[#43189E] ring-4 ring-purple-100">
          {user?.profileImage ? (
            <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-extrabold text-2xl tracking-wider font-numeric-display">
              {getInitials(user?.name)}
            </span>
          )}
        </div>

        {/* User Details & Edit Profile Pill */}
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] md:text-[22px] font-extrabold text-slate-900 truncate tracking-tight">
            {user?.name || 'Kharcha User'}
          </h2>
          <p className="text-sm font-medium text-slate-500 truncate mt-0.5">
            {user?.email || 'user@example.com'}
          </p>

          <button
            type="button"
            onClick={() => {
              setEditName(user?.name || '');
              setEditEmail(user?.email || '');
              setShowEditProfile(true);
            }}
            className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#F3E8FF] hover:bg-[#E9D5FF] text-[#6D28D9] font-bold text-xs md:text-sm transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Icon name="edit" className="text-[14px]" />
            <span>Edit Profile</span>
          </button>
        </div>
      </section>

      {/* Settings Section (Matching Screenshot) */}
      <section className="mt-8">
        <h2 className="text-[19px] font-extrabold text-slate-900 tracking-tight mb-3">
          Settings
        </h2>

        <div className="bg-white/80 backdrop-blur-xs rounded-[24px] border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-slate-100/80">
          {/* Categories */}
          <button
            type="button"
            onClick={() => navigate('/categories')}
            className="flex items-center w-full px-4 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer group text-left"
          >
            <div className="w-11 h-11 rounded-[16px] bg-[#F3E8FF] flex items-center justify-center text-[#6D28D9] mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <Icon name="category" className="text-[20px]" />
            </div>
            <span className="flex-1 font-bold text-slate-800 text-[15px]">Categories</span>
            <Icon name="chevron_right" className="text-slate-400 text-[20px] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Appearance */}
          <button
            type="button"
            onClick={() => setShowAppearanceModal(true)}
            className="flex items-center w-full px-4 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer group text-left"
          >
            <div className="w-11 h-11 rounded-[16px] bg-[#F3E8FF] flex items-center justify-center text-[#6D28D9] mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <Icon name="palette" className="text-[20px]" />
            </div>
            <span className="flex-1 font-bold text-slate-800 text-[15px]">Appearance</span>
            <span className="text-sm font-medium text-slate-500 capitalize mr-2">{theme}</span>
            <Icon name="chevron_right" className="text-slate-400 text-[20px] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Daily Expense Reminder */}
          <button
            type="button"
            onClick={() => navigate('/profile/reminders')}
            className="flex items-center w-full px-4 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer group text-left"
          >
            <div className="w-11 h-11 rounded-[16px] bg-[#F3E8FF] flex items-center justify-center text-[#6D28D9] mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <Icon name="notifications" className="text-[20px]" />
            </div>
            <span className="flex-1 font-bold text-slate-800 text-[15px]">Daily Expense Reminder</span>
            <span className="text-sm font-medium text-slate-500 mr-2">
              {user?.settings?.notifications?.enabled
                ? `${user.settings.notifications.reminders?.filter((reminder) => reminder.enabled).length || 1} active`
                : 'Off'}
            </span>
            <Icon name="chevron_right" className="text-slate-400 text-[20px] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Monthly Budget */}
          <button
            type="button"
            onClick={() => {
              setMonthlyBudget(user?.settings?.monthlyBudget ?? '');
              setOpeningCashBalance(user?.settings?.openingCashBalance ?? 0);
              setOpeningBankBalance(user?.settings?.openingBankBalance ?? 0);
              setShowBudgetModal(true);
            }}
            className="flex items-center w-full px-4 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer group text-left"
          >
            <div className="w-11 h-11 rounded-[16px] bg-[#F3E8FF] flex items-center justify-center text-[#6D28D9] mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <Icon name="account_balance_wallet" className="text-[20px]" />
            </div>
            <span className="flex-1 font-bold text-slate-800 text-[15px]">Monthly Budget</span>
            <span className="text-sm font-bold text-slate-700 font-numeric-display mr-2">
              {Number(user?.settings?.monthlyBudget) > 0
                ? `₹${Number(user.settings.monthlyBudget).toLocaleString('en-IN')}`
                : '₹5,000'}
            </span>
            <Icon name="chevron_right" className="text-slate-400 text-[20px] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Backup & Data */}
          <button
            type="button"
            onClick={() => setShowBackupModal(true)}
            className="flex items-center w-full px-4 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer group text-left"
          >
            <div className="w-11 h-11 rounded-[16px] bg-[#F3E8FF] flex items-center justify-center text-[#6D28D9] mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <Icon name="cloud_sync" className="text-[20px]" />
            </div>
            <span className="flex-1 font-bold text-slate-800 text-[15px]">Backup & Data</span>
            <Icon name="chevron_right" className="text-slate-400 text-[20px] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* About */}
          <button
            type="button"
            onClick={() => setShowAboutModal(true)}
            className="flex items-center w-full px-4 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer group text-left"
          >
            <div className="w-11 h-11 rounded-[16px] bg-[#F3E8FF] flex items-center justify-center text-[#6D28D9] mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <Icon name="info" className="text-[20px]" />
            </div>
            <span className="flex-1 font-bold text-slate-800 text-[15px]">About</span>
            <Icon name="chevron_right" className="text-slate-400 text-[20px] group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center w-full px-4 py-3.5 hover:bg-red-50/40 transition-colors cursor-pointer group text-left"
          >
            <div className="w-11 h-11 rounded-[16px] bg-[#FEE2E2] flex items-center justify-center text-[#DC2626] mr-4 shrink-0 group-hover:scale-105 transition-transform">
              <Icon name="logout" className="text-[20px]" />
            </div>
            <span className="flex-1 font-bold text-[#DC2626] text-[15px]">Logout</span>
            <Icon name="chevron_right" className="text-slate-400 text-[20px] group-hover:text-[#DC2626] group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </section>

      {/* --- MODALS --- */}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-[420px] shadow-2xl border border-slate-100 flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Edit Profile</h3>
              <p className="text-xs text-slate-500 mt-0.5">Update your personal account details</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[16px] px-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-[#43189E] transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[16px] px-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-[#43189E] transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">Profile Picture</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files[0])}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#EDE9FE] file:text-[#6D28D9] hover:file:bg-[#DDD6FE] cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditProfile(false)}
                  className="px-5 py-2.5 text-slate-600 font-bold text-sm rounded-[16px] hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#43189E] hover:bg-[#381384] text-white font-bold text-sm rounded-[16px] shadow-md shadow-indigo-950/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appearance Modal */}
      {showAppearanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-[380px] shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Appearance</h3>
              <p className="text-xs text-slate-500 mt-0.5">Choose your preferred visual theme</p>
            </div>

            <div className="space-y-2 mt-2">
              {['light', 'dark', 'system'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    changeTheme(t);
                    setShowAppearanceModal(false);
                  }}
                  className={`w-full h-12 px-4 rounded-[16px] flex items-center justify-between capitalize border cursor-pointer transition-all ${
                    theme === t
                      ? 'bg-[#EDE9FE] border-purple-300 text-[#43189E] font-bold shadow-2xs'
                      : 'border-slate-200/80 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{t} Theme</span>
                  {theme === t && <Icon name="check" className="text-[#43189E] text-[18px]" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAppearanceModal(false)}
              className="w-full py-2.5 text-slate-600 font-bold text-sm rounded-[16px] hover:bg-slate-100 mt-2 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Monthly Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-[420px] shadow-2xl border border-slate-100 flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Budget & Wallets</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set your monthly spending limit and starting balances.
              </p>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5" htmlFor="monthly-budget">
                  Monthly Budget (₹)
                </label>
                <input
                  id="monthly-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[16px] px-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-[#43189E] transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5" htmlFor="opening-cash-balance">
                  Opening Cash Balance (₹)
                </label>
                <input
                  id="opening-cash-balance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingCashBalance}
                  onChange={(e) => setOpeningCashBalance(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[16px] px-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-[#43189E] transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5" htmlFor="opening-bank-balance">
                  Opening Bank / UPI Balance (₹)
                </label>
                <input
                  id="opening-bank-balance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingBankBalance}
                  onChange={(e) => setOpeningBankBalance(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-[16px] px-4 text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-[#43189E] transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-5 py-2.5 text-slate-600 font-bold text-sm rounded-[16px] hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#43189E] hover:bg-[#381384] text-white font-bold text-sm rounded-[16px] shadow-md shadow-indigo-950/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backup & Data Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-[420px] shadow-2xl border border-slate-100 flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Backup & Data</h3>
              <p className="text-xs text-slate-500 mt-0.5">Export, restore, or wipe your transaction data</p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full h-12 bg-slate-50 border border-slate-200 text-slate-800 rounded-[16px] font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <Icon name="download" className="text-[18px] text-[#43189E]" />
                Export Expenses (JSON)
              </button>

              <label className="w-full h-12 bg-slate-50 border border-slate-200 text-slate-800 rounded-[16px] font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-all cursor-pointer">
                <Icon name="file_upload" className="text-[18px] text-[#43189E]" />
                Import Expenses
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>

              <button
                type="button"
                onClick={() => setShowClearDataConfirm(true)}
                className="w-full h-12 bg-red-50 border border-red-200 text-red-600 rounded-[16px] font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all cursor-pointer"
              >
                <Icon name="delete_forever" className="text-[18px]" />
                Clear All Data
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowBackupModal(false)}
              className="w-full py-2.5 text-slate-600 font-bold text-sm rounded-[16px] hover:bg-slate-100 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Dialog */}
      {showClearDataConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-[400px] shadow-2xl border border-red-200 flex flex-col gap-4">
            <h3 className="text-xl font-extrabold text-red-600 tracking-tight">
              Delete all expenses and data?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              This action cannot be undone. All your expenses, split debts, and transaction history will be permanently wiped.
            </p>
            <div className="flex justify-end gap-3 mt-3">
              <button
                type="button"
                onClick={() => setShowClearDataConfirm(false)}
                className="px-5 py-2.5 text-slate-600 font-bold text-sm rounded-[16px] hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllData}
                disabled={loading}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-[16px] shadow-md shadow-red-950/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-[380px] shadow-2xl border border-slate-100 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 bg-[#EDE9FE] rounded-[22px] flex items-center justify-center text-[#43189E] mb-1">
              <Icon name="account_balance_wallet" className="text-[32px]" />
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kharcha</h3>
            <p className="text-xs font-semibold text-slate-500">Track · Plan · Save</p>
            <div className="my-1.5 py-1 px-3.5 bg-slate-100 rounded-full text-xs font-mono text-slate-500">
              Version 1.0.0
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[280px]">
              Designed for fast manual expense entry and effortless group split tracking. Keep track of every rupee with speed and ease.
            </p>
            <button
              type="button"
              onClick={() => setShowAboutModal(false)}
              className="w-full mt-2 py-3 bg-[#43189E] hover:bg-[#381384] text-white font-bold text-sm rounded-[16px] shadow-md shadow-indigo-950/20 active:scale-95 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-[380px] shadow-2xl border border-slate-100 flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Log out of Kharcha?</h3>
              <p className="text-xs text-slate-500 mt-1">Are you sure you want to end your current session?</p>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-5 py-2.5 text-slate-600 font-bold text-sm rounded-[16px] hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-[16px] shadow-md shadow-red-950/20 active:scale-95 transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
