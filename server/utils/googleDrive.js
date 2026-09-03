import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

let driveClient = null;

const getDriveClient = () => {
  if (driveClient) return driveClient;

  // 1. Try Service Account Authentication
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
    );

    driveClient = google.drive({ version: 'v3', auth });
    return driveClient;
  }

  // 2. Try OAuth2 Refresh Token Authentication
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    driveClient = google.drive({ version: 'v3', auth: oauth2Client });
    return driveClient;
  }

  return null;
};

/**
 * Creates Google Drive client for a specific user using their OAuth tokens
 */
const getUserDriveClient = (user) => {
  if (!user || (!user.googleAccessToken && !user.googleRefreshToken)) {
    return null;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
  );

  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
};

/**
 * Finds or creates a subfolder inside a given parent folder in Google Drive
 */
const getOrCreateSubfolder = async (drive, folderName, parentFolderId = null) => {
  try {
    const escapedName = folderName.replace(/'/g, "\\'");
    let q = `mimeType='application/vnd.google-apps.folder' and name='${escapedName}' and trashed=false`;
    if (parentFolderId) {
      q += ` and '${parentFolderId}' in parents`;
    }

    const response = await drive.files.list({
      q,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // Create subfolder
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : [],
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id',
    });

    return folder.data.id;
  } catch (error) {
    console.warn(`Could not find or create '${folderName}' folder in Google Drive:`, error.message);
    return null;
  }
};

/**
 * Finds or creates a "Receipts" folder in user's personal Google Drive
 */
const getOrCreateReceiptsFolder = async (drive) => {
  return await getOrCreateSubfolder(drive, 'Receipts', null);
};

/**
 * Uploads a receipt image to Google Drive under "Receipts / <CategoryName>" folder
 */
export const uploadFileToDrive = async (filePath, originalName, mimeType, user = null, categoryName = 'General') => {
  try {
    let drive = null;

    // 1. Try User's Personal Google Drive first (if logged in via Google)
    if (user) {
      drive = getUserDriveClient(user);
    }

    // 2. Fallback to System Drive client
    if (!drive) {
      drive = getDriveClient();
    }

    if (!drive) {
      return null; // No Google Drive available
    }

    // 1. Find or create base "Receipts" folder
    let receiptsFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!receiptsFolderId) {
      receiptsFolderId = await getOrCreateReceiptsFolder(drive);
    }

    // 2. Find or create category-wise subfolder inside "Receipts" folder
    const cleanCategoryName = (categoryName || 'General').trim();
    let targetFolderId = receiptsFolderId;

    if (receiptsFolderId && cleanCategoryName) {
      const catFolderId = await getOrCreateSubfolder(drive, cleanCategoryName, receiptsFolderId);
      if (catFolderId) {
        targetFolderId = catFolderId;
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const dateFormatted = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;

    // Extract file extension from original name
    const ext = path.extname(originalName) || (mimeType.includes('png') ? '.png' : mimeType.includes('webp') ? '.webp' : '.jpg');

    const fileMetaData = {
      name: `receipt_${dateFormatted}${ext}`,
      parents: targetFolderId ? [targetFolderId] : [],
    };

    const media = {
      mimeType,
      body: fs.createReadStream(filePath),
    };

    const file = await drive.files.create({
      resource: fileMetaData,
      media,
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = file.data.id;

    // Set permission to anyone with link can view
    try {
      await drive.permissions.create({
        fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (permErr) {
      console.warn('Could not make drive file public:', permErr.message);
    }

    // Direct embeddable image link
    const driveUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    return driveUrl;
  } catch (error) {
    console.error('Google Drive upload error:', error.message);
    return null;
  }
};
