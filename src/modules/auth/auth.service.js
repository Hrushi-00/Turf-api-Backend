const Auth = require('./auth.model');

const buildAdminPayload = (admin) => ({
  id: admin._id,
  username: admin.username,
  email: admin.email,
  role: admin.role
});

const register = async (data) => {
  const { username, email, password } = data;

  const existingAdmin = await Auth.findOne({ email });
  if (existingAdmin) {
    throw Object.assign(new Error('Admin already exists'), { statusCode: 409 });
  }

  const admin = await Auth.create({
    username,
    email,
    password,
    role: 'Admin'
  });

  const token = admin.getSignedJwtToken();
  const user = buildAdminPayload(admin);
  return { success: true, token, admin: user, user };
};

const login = async (data) => {
  const { email, password } = data;

  const admin = await Auth.findOne({ email });
  if (!admin || admin.role === 'BusinessUser') {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const isMatch = await admin.matchPassword(password);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const token = admin.getSignedJwtToken();
  const user = buildAdminPayload(admin);
  return { success: true, token, admin: user, user };
};

const getProfile = async (adminId) => {
  const admin = await Auth.findById(adminId).select('-password');
  if (!admin || (admin.role !== 'Admin' && admin.role !== 'SuperAdmin')) {
    throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
  }
  return { success: true, admin, user: buildAdminPayload(admin) };
};

const updateProfile = async (adminId, data) => {
  const admin = await Auth.findById(adminId);
  if (!admin || (admin.role !== 'Admin' && admin.role !== 'SuperAdmin')) {
    throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
  }

  const { username, email } = data;
  if (username !== undefined) admin.username = username;
  if (email !== undefined) admin.email = email;
  await admin.save();

  return {
    success: true,
    message: 'Profile updated successfully',
    admin: buildAdminPayload(admin),
    user: buildAdminPayload(admin)
  };
};

const changePassword = async (adminId, data) => {
  const { currentPassword, newPassword } = data;
  const admin = await Auth.findById(adminId);
  if (!admin || (admin.role !== 'Admin' && admin.role !== 'SuperAdmin')) {
    throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
  }

  const isMatch = await admin.matchPassword(currentPassword);
  if (!isMatch) {
    throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
  }

  admin.password = newPassword;
  await admin.save();
  return { success: true, message: 'Password changed successfully' };
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  buildAdminPayload
};
