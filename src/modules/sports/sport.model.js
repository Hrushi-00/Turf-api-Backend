const mongoose = require('mongoose');
const sportSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 60, match: /^[a-z0-9-]+$/ },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  iconUrl: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true }
}, { timestamps: true });
module.exports = mongoose.model('Sport', sportSchema);
