const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const tokenModel = require('../models/token.model');
const mailer = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const JWT_EXPIRY = process.env.JWT_EXPIRES_IN || '8h';
const ALLOWED_ROLES = ['NGO Admin', 'Field Worker', 'Finance Officer', 'Auditor'];
const resetTokens = new Map();
const REFRESH_TOKEN_EXPIRES_MS = Number(process.env.REFRESH_TOKEN_EXPIRES_MS) || 7 * 24 * 3600 * 1000; // 7 days

function formatUser(user) {
  return {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}

async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role selected.' });
    }

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await userModel.createUser({
      name,
      email,
      password: hashedPassword,
      role,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Your account is pending admin approval.',
    });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({ success: false, message: 'Unable to register user.' });
  }
}

async function login(req, res) {
  try {
    const { email, password, role } = req.body;
    const user = await userModel.findByEmail(email);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.role !== role) {
      return res.status(401).json({ success: false, message: 'Selected role does not match this account.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval.' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ success: false, message: 'This account has been rejected.' });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // create refresh token
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshExpires = Date.now() + REFRESH_TOKEN_EXPIRES_MS;
    await tokenModel.createToken(user.user_id, refreshToken, refreshExpires);

    return res.json({ success: true, data: { token, refreshToken, user: formatUser(user) } });
  } catch (error) {
    console.error('login error', error);
    return res.status(500).json({ success: false, message: 'Unable to log in.' });
  }
}

async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required.' });
    }

    const stored = await tokenModel.findByToken(refreshToken);
    if (!stored || stored.expires < Date.now()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const user = await userModel.findById(stored.user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const newAccessToken = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    return res.json({ success: true, data: { token: newAccessToken } });
  } catch (error) {
    console.error('refreshToken error', error);
    return res.status(500).json({ success: false, message: 'Unable to refresh token.' });
  }
}

function getRoles(req, res) {
  return res.json({
    success: true,
    roles: ALLOWED_ROLES,
  });
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If that email is registered, a password reset email has been sent.',
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expires = Date.now() + 3600 * 1000;
    resetTokens.set(token, { user_id: user.user_id, expires });

    const resetUrlBase = process.env.RESET_PASSWORD_URL || 'http://localhost:3000/reset-password?token=';
    const resetLink = `${resetUrlBase}${token}`;
    const emailSubject = 'Umeed-e-Sahar Password Reset Request';
    const emailText = `Hello ${user.name},\n\nWe received a request to reset your password. Use the link below to reset it:\n\n${resetLink}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.\n\nRegards,\nUmeed-e-Sahar Foundation`;
    const emailHtml = `<p>Hello ${user.name},</p><p>We received a request to reset your password. Click the link below to reset it:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p><p>Regards,<br/>Umeed-e-Sahar Foundation</p>`;

    await mailer.sendMail({
      to: user.email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    return res.json({
      success: true,
      message: 'If that email is registered, a password reset email has been sent.',
    });
  } catch (error) {
    console.error('forgotPassword error', error);
    return res.status(500).json({ success: false, message: 'Unable to process password reset request.' });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, new_password } = req.body;
    const resetEntry = resetTokens.get(token);

    if (!resetEntry || resetEntry.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const user = await userModel.findById(resetEntry.user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await userModel.updatePassword(user.user_id, hashedPassword);
    resetTokens.delete(token);

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error('resetPassword error', error);
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
}

function logout(req, res) {
  // revoke refresh tokens for the user (if any)
  const userId = req.user && req.user.user_id;
  if (userId) {
    tokenModel.deleteTokensByUser(userId).catch((err) => console.error('logout token delete error', err));
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
}

async function getMe(req, res) {
  try {
    const user = await userModel.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, data: { user: formatUser(user) } });
  } catch (error) {
    console.error('getMe error', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch user profile.' });
  }
}

async function changePassword(req, res) {
  try {
    const { old_password, new_password } = req.body;
    const user = await userModel.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const passwordMatch = await bcrypt.compare(old_password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Old password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await userModel.updatePassword(user.user_id, hashedPassword);

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('changePassword error', error);
    return res.status(500).json({ success: false, message: 'Unable to change password.' });
  }
}

async function getPendingUsers(req, res) {
  try {
    const users = await userModel.getPendingUsers();
    return res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error('getPendingUsers error', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch pending users.' });
  }
}

async function getAllUsers(req, res) {
  try {
    const users = await userModel.getAllUsers();
    return res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error('getAllUsers error', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch users.' });
  }
}

async function approveUser(req, res) {
  try {
    const { userId } = req.params;
    const updated = await userModel.updateUserStatus(userId, 'approved');
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, message: 'User approved successfully.' });
  } catch (error) {
    console.error('approveUser error', error);
    return res.status(500).json({ success: false, message: 'Unable to approve user.' });
  }
}

async function rejectUser(req, res) {
  try {
    const { userId } = req.params;
    const updated = await userModel.updateUserStatus(userId, 'rejected');
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, message: 'User rejected successfully.' });
  } catch (error) {
    console.error('rejectUser error', error);
    return res.status(500).json({ success: false, message: 'Unable to reject user.' });
  }
}

module.exports = {
  register,
  login,
  refreshToken,
  getRoles,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
  changePassword,
  getPendingUsers,
  getAllUsers,
  approveUser,
  rejectUser,
};
