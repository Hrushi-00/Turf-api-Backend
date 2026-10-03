const User = require('./user.model');
const crypto = require('crypto');

const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const issueSession = async (user) => {
  const accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  const token = user.getSignedJwtToken();
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const refreshTokenDays = Number(process.env.JWT_REFRESH_EXPIRES_DAYS) || 30;
  user.refreshTokenHash = hashRefreshToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000);
  await user.save();
  return { token, accessTokenExpiresIn, refreshToken, refreshTokenExpiresIn: `${refreshTokenDays}d` };
};

const buildUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  contactNumber: user.contactNumber,
  profileImage: user.profileImage,
  address: user.address,
  role: user.role
});

const signup = async (data) => {
  const { name, email, password, contactNumber, address, profileImage } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw Object.assign(new Error('User already exists'), { statusCode: 409 });
  }

  const user = await User.create({
    name,
    email,
    password,
    contactNumber,
    address,
    profileImage
  });

  const session = await issueSession(user);
  return {
    success: true,
    ...session,
    user: buildUserPayload(user)
  };
};

const login = async (data) => {
  const { email, password } = data;

  const user = await User.findOne({ email });
  if (!user) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const session = await issueSession(user);
  return {
    success: true,
    message: 'Login successful',
    ...session,
    user: buildUserPayload(user)
  };
};

const refresh = async (refreshToken) => {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw Object.assign(new Error('refreshToken is required'), { statusCode: 400 });
  }
  const user = await User.findOne({
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshTokenExpiresAt: { $gt: new Date() }
  }).select('+refreshTokenHash +refreshTokenExpiresAt');
  if (!user) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }
  const session = await issueSession(user);
  return { success: true, ...session, user: buildUserPayload(user) };
};

const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } });
  return { success: true, message: 'Logged out successfully' };
};

const getProfile = async (userId) => {
  const user = await User.findById(userId)
    .select('-password')
    .populate('bookings');

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  return { success: true, user };
};

const updateProfile = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const { name, email, contactNumber, address, profileImage } = data;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (contactNumber !== undefined) user.contactNumber = contactNumber;
  if (address !== undefined) user.address = address;
  if (profileImage !== undefined) user.profileImage = profileImage;
  await user.save();

  return {
    success: true,
    message: 'Profile updated successfully',
    user: buildUserPayload(user)
  };
};

const changePassword = async (userId, data) => {
  const { currentPassword, newPassword } = data;
  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
  }

  user.password = newPassword;
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();
  return { success: true, message: 'Password changed successfully' };
};

const deleteAccount = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }
  await user.deleteOne();
  return { success: true, message: 'Account deleted successfully' };
};

module.exports = {
  signup,
  login,
  refresh,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  buildUserPayload
};
