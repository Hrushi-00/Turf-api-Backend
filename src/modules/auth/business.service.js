const Auth = require('./auth.model');

const buildBusinessPayload = (businessUser) => ({
  id: businessUser._id,
  username: businessUser.username,
  email: businessUser.email,
  role: businessUser.role
});

const signup = async (data) => {
  const { username, email, password } = data;

  const existingUser = await Auth.findOne({ email });
  if (existingUser) {
    throw Object.assign(new Error('Business user already exists'), { statusCode: 409 });
  }

  const businessUser = await Auth.create({
    username,
    email,
    password,
    role: 'BusinessUser'
  });

  const token = businessUser.getSignedJwtToken();
  const user = buildBusinessPayload(businessUser);
  return {
    success: true,
    token,
    businessUser: user,
    user
  };
};

const login = async (data) => {
  const { email, password } = data;

  const businessUser = await Auth.findOne({ email });
  if (!businessUser || businessUser.role !== 'BusinessUser') {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const isMatch = await businessUser.matchPassword(password);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const token = businessUser.getSignedJwtToken();
  const user = buildBusinessPayload(businessUser);
  return {
    success: true,
    message: 'Login successful',
    token,
    businessUser: user,
    user
  };
};

const getProfile = async (businessUserId) => {
  const businessUser = await Auth.findById(businessUserId).select('-password');
  if (!businessUser || businessUser.role !== 'BusinessUser') {
    throw Object.assign(new Error('Business user not found'), { statusCode: 404 });
  }
  return { success: true, businessUser, user: buildBusinessPayload(businessUser) };
};

const updateProfile = async (businessUserId, data) => {
  const businessUser = await Auth.findById(businessUserId);
  if (!businessUser || businessUser.role !== 'BusinessUser') {
    throw Object.assign(new Error('Business user not found'), { statusCode: 404 });
  }

  const { username, email } = data;
  if (username !== undefined) businessUser.username = username;
  if (email !== undefined) businessUser.email = email;
  await businessUser.save();

  return {
    success: true,
    message: 'Profile updated successfully',
    businessUser: buildBusinessPayload(businessUser),
    user: buildBusinessPayload(businessUser)
  };
};

const changePassword = async (businessUserId, data) => {
  const { currentPassword, newPassword } = data;
  const businessUser = await Auth.findById(businessUserId);
  if (!businessUser || businessUser.role !== 'BusinessUser') {
    throw Object.assign(new Error('Business user not found'), { statusCode: 404 });
  }

  const isMatch = await businessUser.matchPassword(currentPassword);
  if (!isMatch) {
    throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
  }

  businessUser.password = newPassword;
  await businessUser.save();
  return { success: true, message: 'Password changed successfully' };
};

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  changePassword,
  buildBusinessPayload
};
