const Business = require('./business.model');

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const fields = [
  'legalName', 'displayName', 'description', 'businessType', 'contactEmail',
  'contactPhone', 'website', 'registrationNumber', 'taxIdMasked', 'address', 'timezone'
];

const safeData = (data) => Object.fromEntries(fields
  .filter((key) => data[key] !== undefined)
  .map((key) => [key, data[key]]));

const getProfile = async (ownerId) => {
  const business = await Business.findOne({ owner: ownerId }).select('-__v');
  return { success: true, data: business };
};

const saveProfile = async (ownerId, data) => {
  let business = await Business.findOne({ owner: ownerId });
  const created = !business;
  if (!business) business = new Business({ owner: ownerId });
  const changes = safeData(data);
  business.set(changes);

  // Editing a previously rejected or approved profile always requires review.
  if (!created && Object.keys(changes).length) {
    business.approvalStatus = 'PENDING';
    business.rejectionReason = '';
    business.reviewedBy = undefined;
    business.reviewedAt = undefined;
  }
  await business.save();
  return { success: true, created, data: business };
};

const reviewBusiness = async (businessId, adminId, decision, reason = '') => {
  if (!['APPROVED', 'REJECTED', 'REQUIRES_ACTION'].includes(decision)) {
    throw fail('Invalid business approval decision', 400);
  }
  const business = await Business.findById(businessId);
  if (!business) throw fail('Business not found', 404);
  business.approvalStatus = decision;
  business.operationalStatus = decision === 'APPROVED' && business.subscriptionStatus === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  business.rejectionReason = decision === 'APPROVED' ? '' : reason;
  business.reviewedBy = adminId;
  business.reviewedAt = new Date();
  await business.save();
  return { success: true, data: business };
};

const listBusinesses = async ({ status = 'PENDING', page = 1, limit = 20 } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const query = status === 'ALL' ? {} : { approvalStatus: status };
  const [data, total] = await Promise.all([
    Business.find(query).populate('owner', 'username email role').sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize).limit(pageSize),
    Business.countDocuments(query)
  ]);
  return { success: true, data, total, page: pageNumber, pages: Math.ceil(total / pageSize) };
};

module.exports = { getProfile, saveProfile, reviewBusiness, listBusinesses };
