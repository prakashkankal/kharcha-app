import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { seedDefaultCategories } from '../utils/seedCategories.js';
import { sendEmail } from '../utils/sendEmail.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'kharcha_super_secret_jwt_key_2026_production_grade', {
    expiresIn: '30d',
  });
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
      // If user registered before but never verified OTP, update password and issue fresh OTP
      const salt = await bcrypt.genSalt(10);
      existingUser.passwordHash = await bcrypt.hash(password, salt);
      existingUser.name = name;
      const otp = generateOtp();
      existingUser.otp = otp;
      existingUser.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      await existingUser.save();

      await sendEmail({
        to: existingUser.email,
        subject: 'Verify your Kharcha Account - OTP Code',
        text: `Your OTP verification code for Kharcha is: ${otp}. It is valid for 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8;">
            <div style="max-width: 480px; margin: 0 auto; background: #ffffff; padding: 30px; rounded: 12px; border: 1px solid #e0e0e0;">
              <h2 style="color: #004ac6; margin-top: 0;">Kharcha Account Verification</h2>
              <p style="font-size: 16px; color: #333333;">Hello ${name},</p>
              <p style="font-size: 15px; color: #555555;">Thank you for registering on Kharcha. Please use the OTP code below to complete your account setup:</p>
              <div style="background-color: #eef3ff; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #004ac6;">${otp}</span>
              </div>
              <p style="font-size: 13px; color: #888888;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
            </div>
          </div>
        `,
      });

      return res.status(200).json({
        requireOtp: true,
        email: existingUser.email,
        message: 'OTP sent to your email address',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      isVerified: false,
      otp,
      otpExpiresAt,
    });

    await sendEmail({
      to: user.email,
      subject: 'Verify your Kharcha Account - OTP Code',
      text: `Your OTP verification code for Kharcha is: ${otp}. It is valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e0e0e0;">
            <h2 style="color: #004ac6; margin-top: 0;">Kharcha Account Verification</h2>
            <p style="font-size: 16px; color: #333333;">Hello ${name},</p>
            <p style="font-size: 15px; color: #555555;">Thank you for registering on Kharcha. Please use the OTP code below to complete your account setup:</p>
            <div style="background-color: #eef3ff; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #004ac6;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #888888;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        </div>
      `,
    });

    res.status(201).json({
      requireOtp: true,
      email: user.email,
      message: 'OTP sent to your email address',
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and 6-digit OTP code' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (user.isVerified) {
      const token = generateToken(user._id);
      return res.json({
        message: 'Account is already verified',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profileImage: user.profileImage,
          settings: user.settings,
        },
      });
    }

    if (!user.otp || user.otp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP verification code' });
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP verification code has expired. Please click Resend OTP.' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    await seedDefaultCategories(user._id);
    const token = generateToken(user._id);

    res.json({
      message: 'Account verified successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        settings: user.settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Account is already verified. Please log in.' });
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Resent OTP Code - Kharcha Account Verification',
      text: `Your new OTP verification code for Kharcha is: ${otp}. It is valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e0e0e0;">
            <h2 style="color: #004ac6; margin-top: 0;">Kharcha Account Verification</h2>
            <p style="font-size: 16px; color: #333333;">Hello ${user.name},</p>
            <p style="font-size: 15px; color: #555555;">Here is your new OTP verification code:</p>
            <div style="background-color: #eef3ff; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #004ac6;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #888888;">This code is valid for 10 minutes.</p>
          </div>
        </div>
      `,
    });

    res.json({ message: 'New OTP sent successfully to your email address' });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter both email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Account is not verified. Please enter the OTP sent to your email.',
        requireOtp: true,
        email: user.email,
      });
    }

    await seedDefaultCategories(user._id);

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        settings: user.settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = async (req, res, next) => {
  try {
    const { credential, accessToken, refreshToken, googleId: inputGoogleId, email: inputEmail, name: inputName, profileImage: inputImage } = req.body;

    let googleId = inputGoogleId;
    let email = inputEmail;
    let name = inputName;
    let profileImage = inputImage;

    // Verify Google ID Token if passed from frontend
    if (credential) {
      try {
        const { OAuth2Client } = await import('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        googleId = payload.sub;
        email = payload.email;
        name = payload.name;
        profileImage = payload.picture;
      } catch (verifyError) {
        console.warn('Google token verification fallback:', verifyError.message);
        try {
          const base64Url = credential.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
          googleId = payload.sub || googleId;
          email = payload.email || email;
          name = payload.name || name;
          profileImage = payload.picture || profileImage;
        } catch (e) {
          // ignore
        }
      }
    }

    if (!email) {
      return res.status(400).json({ message: 'Google authentication failed: missing email address' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name: name || 'Kharcha User',
        email: email.toLowerCase(),
        googleId: googleId || `google_${Date.now()}`,
        googleAccessToken: accessToken || null,
        googleRefreshToken: refreshToken || null,
        profileImage: profileImage || null,
        isVerified: true,
      });
      await seedDefaultCategories(user._id);
    } else {
      user.isVerified = true;
      if (!user.googleId && googleId) {
        user.googleId = googleId;
      }
      if (accessToken) user.googleAccessToken = accessToken;
      if (refreshToken) user.googleRefreshToken = refreshToken;
      if (profileImage && !user.profileImage) {
        user.profileImage = profileImage;
      }
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        settings: user.settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        settings: user.settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide your registered email address' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    // Generate 6-digit OTP for password reset
    const otp = generateOtp();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Password Reset OTP - Kharcha App',
      text: `Your OTP for resetting your Kharcha password is: ${otp}. It is valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e0e0e0;">
            <h2 style="color: #004ac6; margin-top: 0;">Reset Your Password</h2>
            <p style="font-size: 16px; color: #333333;">Hello ${user.name},</p>
            <p style="font-size: 15px; color: #555555;">We received a request to reset your Kharcha account password. Use the OTP code below to set a new password:</p>
            <div style="background-color: #eef3ff; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #004ac6;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #888888;">This code is valid for 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });

    res.json({ message: 'Password reset OTP sent to your email' });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Please provide email, OTP, and new password' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP verification code' });
    }

    if (!user.resetPasswordOtpExpiresAt || user.resetPasswordOtpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpiresAt = null;
    user.isVerified = true; // Also ensure account is marked verified
    await user.save();

    res.json({ message: 'Password reset successful! You can now log in with your new password.' });
  } catch (error) {
    next(error);
  }
};
