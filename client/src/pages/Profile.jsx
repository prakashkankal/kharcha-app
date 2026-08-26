import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { profileApi } from '../services/profileApi';
import { backupApi } from '../services/backupApi';

export const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { theme, changeTheme } = useTheme();

  // Modals
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);

  // Form states
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [avatarFile, setAvatarFile] = useState(null);

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
      } catch (err) {
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
    <div class="w-full max-w-[1024px] mx-auto pb-12 space-y-6">
      {/* Header */}
      <header class="flex items-center justify-between h-12 border-b border-outline-variant pb-2">
        <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-primary font-bold">Profile</h1>
      </header>

      {/* Alert Messages */}
      {msg.text && (
        <div
          class={`px-4 py-3 rounded-lg font-body-sm flex items-center justify-between border ${
            msg.type === 'error'
              ? 'bg-error-container text-on-error-container border-error/20'
              : 'bg-secondary-container text-on-secondary-container border-secondary/20'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg({ type: '', text: '' })} class="text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Profile Hero Section (Bento Card) */}
      <section class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-xs">
        <div class="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-surface-container-high shrink-0 bg-surface-container flex items-center justify-center text-3xl">
          {user?.profileImage ? (
            <img src={user.profileImage} alt={user.name} class="w-full h-full object-cover" />
          ) : (
            <span class="material-symbols-outlined text-[48px] text-primary">account_circle</span>
          )}
        </div>

        <div class="flex flex-col items-center md:items-start text-center md:text-left flex-1 gap-1">
          <h2 class="font-headline-lg-mobile text-[24px] md:text-[28px] text-on-surface font-bold">
            {user?.name || 'Kharcha User'}
          </h2>
          <p class="font-body-lg text-on-surface-variant">{user?.email || 'user@example.com'}</p>
        </div>

        <div>
          <button
            onClick={() => {
              setEditName(user?.name || '');
              setEditEmail(user?.email || '');
              setShowEditProfile(true);
            }}
            class="bg-surface-container-lowest border border-outline-variant text-primary font-title-md px-4 py-2.5 rounded-lg hover:bg-surface-container-low transition-colors h-11 min-w-[120px]"
          >
            Edit Profile
          </button>
        </div>
      </section>

      {/* Settings Menu List */}
      <section class="flex flex-col gap-2">
        <h3 class="font-title-md text-title-md text-on-surface-variant px-1 font-semibold">Settings</h3>
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex flex-col divide-y divide-outline-variant">
          {/* Categories Item */}
          <button
            onClick={() => navigate('/categories')}
            class="flex items-center w-full px-4 py-3 min-h-[56px] hover:bg-surface-container-low transition-colors"
          >
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface mr-4 shrink-0">
              <span class="material-symbols-outlined">category</span>
            </div>
            <div class="flex-1 text-left">
              <span class="font-body-lg text-on-surface font-medium">Categories</span>
            </div>
            <span class="material-symbols-outlined text-outline">chevron_right</span>
          </button>

          {/* Appearance Item */}
          <button
            onClick={() => setShowAppearanceModal(true)}
            class="flex items-center w-full px-4 py-3 min-h-[56px] hover:bg-surface-container-low transition-colors"
          >
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface mr-4 shrink-0">
              <span class="material-symbols-outlined">palette</span>
            </div>
            <div class="flex-1 text-left">
              <span class="font-body-lg text-on-surface font-medium">Appearance</span>
            </div>
            <span class="font-body-sm text-on-surface-variant capitalize mr-2">{theme}</span>
            <span class="material-symbols-outlined text-outline">chevron_right</span>
          </button>

          {/* Backup & Data Item */}
          <button
            onClick={() => setShowBackupModal(true)}
            class="flex items-center w-full px-4 py-3 min-h-[56px] hover:bg-surface-container-low transition-colors"
          >
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface mr-4 shrink-0">
              <span class="material-symbols-outlined">cloud_sync</span>
            </div>
            <div class="flex-1 text-left">
              <span class="font-body-lg text-on-surface font-medium">Backup & Data</span>
            </div>
            <span class="material-symbols-outlined text-outline">chevron_right</span>
          </button>

          {/* About Item */}
          <button
            onClick={() => setShowAboutModal(true)}
            class="flex items-center w-full px-4 py-3 min-h-[56px] hover:bg-surface-container-low transition-colors"
          >
            <div class="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface mr-4 shrink-0">
              <span class="material-symbols-outlined">info</span>
            </div>
            <div class="flex-1 text-left">
              <span class="font-body-lg text-on-surface font-medium">About</span>
            </div>
            <span class="material-symbols-outlined text-outline">chevron_right</span>
          </button>

          {/* Logout Item */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            class="flex items-center w-full px-4 py-3 min-h-[56px] hover:bg-error-container/30 transition-colors group"
          >
            <div class="w-10 h-10 rounded-lg bg-error-container/50 flex items-center justify-center text-error mr-4 shrink-0">
              <span class="material-symbols-outlined">logout</span>
            </div>
            <div class="flex-1 text-left">
              <span class="font-body-lg text-error font-semibold">Logout</span>
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-error">chevron_right</span>
          </button>
        </div>
      </section>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[420px] shadow-lg border border-outline-variant flex flex-col gap-4">
            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              Edit Profile
            </h3>

            <form onSubmit={handleSaveProfile} class="space-y-4">
              <div>
                <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface outline-none"
                />
              </div>

              <div>
                <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface outline-none"
                />
              </div>

              <div>
                <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                  Profile Picture
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files[0])}
                  class="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-surface-container file:text-primary hover:file:bg-surface-container-high"
                />
              </div>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfile(false)}
                  class="px-4 h-10 text-on-surface-variant font-title-md rounded-lg hover:bg-surface-container-low"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  class="px-5 h-10 bg-primary text-on-primary font-title-md rounded-lg hover:bg-primary-container disabled:opacity-50"
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
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[360px] shadow-lg border border-outline-variant flex flex-col gap-4">
            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              Appearance
            </h3>
            <div class="space-y-2">
              {['light', 'dark', 'system'].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    changeTheme(t);
                    setShowAppearanceModal(false);
                  }}
                  class={`w-full h-12 px-4 rounded-lg flex items-center justify-between capitalize border ${
                    theme === t
                      ? 'bg-surface-container border-primary text-primary font-bold'
                      : 'border-outline-variant text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span>{t} Theme</span>
                  {theme === t && <span class="material-symbols-outlined">check</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAppearanceModal(false)}
              class="w-full h-10 text-on-surface-variant font-title-md rounded-lg hover:bg-surface-container-low"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Backup & Data Modal */}
      {showBackupModal && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[420px] shadow-lg border border-outline-variant flex flex-col gap-4">
            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              Backup & Data
            </h3>

            <div class="space-y-3">
              <button
                onClick={handleExportBackup}
                class="w-full h-12 bg-surface border border-outline-variant text-on-surface rounded-lg font-title-md flex items-center justify-center gap-2 hover:bg-surface-container-low"
              >
                <span class="material-symbols-outlined">download</span>
                Export Expenses (JSON)
              </button>

              <label class="w-full h-12 bg-surface border border-outline-variant text-on-surface rounded-lg font-title-md flex items-center justify-center gap-2 hover:bg-surface-container-low cursor-pointer">
                <span class="material-symbols-outlined">file_upload</span>
                Import Expenses
                <input type="file" accept=".json" onChange={handleImportBackup} class="hidden" />
              </label>

              <button
                onClick={() => setShowClearDataConfirm(true)}
                class="w-full h-12 bg-error-container/40 border border-error text-error rounded-lg font-title-md flex items-center justify-center gap-2 hover:bg-error-container"
              >
                <span class="material-symbols-outlined">delete_forever</span>
                Clear All Data
              </button>
            </div>

            <button
              onClick={() => setShowBackupModal(false)}
              class="w-full h-10 text-on-surface-variant font-title-md rounded-lg hover:bg-surface-container-low mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Dialog */}
      {showClearDataConfirm && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[400px] shadow-xl border border-error/30 flex flex-col gap-4">
            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-error font-bold">
              Delete all expenses and data?
            </h3>
            <p class="font-body-lg text-on-surface-variant">
              This action cannot be undone. All your expenses will be permanently wiped from Kharcha.
            </p>
            <div class="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setShowClearDataConfirm(false)}
                class="px-4 h-10 text-on-surface-variant font-title-md rounded-lg hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                disabled={loading}
                class="px-5 h-10 bg-error text-on-error font-title-md rounded-lg hover:bg-error/90 shadow-xs disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[380px] shadow-lg border border-outline-variant flex flex-col items-center text-center gap-3">
            <div class="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center text-primary mb-1">
              <span class="material-symbols-outlined text-[36px]">account_balance_wallet</span>
            </div>
            <h3 class="font-display text-[24px] text-primary font-bold">Kharcha</h3>
            <p class="font-body-sm text-on-surface-variant">Simple expense tracking.</p>
            <div class="my-2 py-2 px-4 bg-surface-container-low rounded-full text-xs font-mono text-outline">
              Version 1.0.0
            </div>
            <p class="font-body-sm text-on-surface-variant text-xs leading-relaxed">
              Designed for fast, manual expense entry. Keep track of your daily expenses with speed and ease.
            </p>
            <button
              onClick={() => setShowAboutModal(false)}
              class="w-full h-10 bg-primary text-on-primary font-title-md rounded-lg hover:bg-primary-container mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[380px] shadow-lg border border-outline-variant flex flex-col gap-4">
            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              Log out of Kharcha?
            </h3>
            <div class="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                class="px-4 h-10 text-on-surface-variant font-title-md rounded-lg hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
                class="px-5 h-10 bg-error text-on-error font-title-md rounded-lg hover:bg-error/90 shadow-xs"
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
