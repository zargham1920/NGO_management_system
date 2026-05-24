const ALLOWED_ROLES = ['NGO Admin', 'Field Worker', 'Finance Officer', 'Auditor'];

function validateRegister(req, res, next) {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Name, email, password and role are required.' });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role selected.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Email, password, and role are required.' });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role selected.' });
  }

  next();
}

function validateChangePassword(req, res, next) {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Old password and new password are required.' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
  }

  next();
}

function validateResetPassword(req, res, next) {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ success: false, message: 'Token and new password are required.' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
  }

  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateResetPassword,
};
