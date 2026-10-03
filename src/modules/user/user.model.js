const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    refreshTokenHash: { type: String, default: null, select: false },
    refreshTokenExpiresAt: { type: Date, default: null, select: false },
    contactNumber: { type: String, required: true },
    role: { type: String, enum: ['user'], default: 'user' },

    profileImage: { type: String, default: '' },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },

    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
      }
    ]
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

module.exports = mongoose.model('User', userSchema);
