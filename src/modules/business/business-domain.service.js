const cloudinary = require('../../config/cloudinary');
const Business = require('./business.model');
const BusinessDocument = require('./business-document.model');
const BusinessStaff = require('./business-staff.model');

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const documentTypes = new Set(['IDENTITY_PROOF', 'BUSINESS_REGISTRATION', 'TAX_DOCUMENT', 'ADDRESS_PROOF', 'BANK_VERIFICATION', 'AUTHORIZATION']);
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const getBusiness = async (ownerId) => {
  const business = await Business.findOne({ owner: ownerId }).select('_id');
  if (!business) throw fail('Complete the business profile first', 409);
  return business;
};

const maskDocumentNumber = (value = '') => {
  const normalized = String(value).replace(/\s/g, '');
  return normalized.length <= 4 ? (normalized ? '*'.repeat(normalized.length) : '') : `${'*'.repeat(normalized.length - 4)}${normalized.slice(-4)}`;
};

const publicDocument = (doc) => ({
  id: doc._id,
  business: doc.business,
  documentType: doc.documentType,
  documentNumberMasked: doc.documentNumberMasked,
  status: doc.status,
  submittedAt: doc.submittedAt,
  reviewedAt: doc.reviewedAt,
  reviewedBy: doc.reviewedBy,
  rejectionReason: doc.rejectionReason,
  expiryDate: doc.expiryDate
});

const submitDocument = async (ownerId, data, file) => {
  if (!documentTypes.has(data.documentType)) throw fail('Invalid document type', 400);
  if (!file) throw fail('A document file is required', 400);
  if (!allowedMimeTypes.has(file.mimetype)) throw fail('Only PDF, JPEG, PNG, or WebP documents are allowed', 400);
  if (file.size > 5 * 1024 * 1024) throw fail('Document must be 5 MB or smaller', 413);
  const business = await getBusiness(ownerId);
  const previous = await BusinessDocument.findOne({ business: business._id, documentType: data.documentType }).select('+storageKey');

  const uploaded = await cloudinary.uploader.upload(file.tempFilePath, {
    folder: `business-documents/${business._id}`,
    resource_type: 'raw',
    type: 'authenticated',
    access_mode: 'authenticated'
  });

  try {
    const doc = await BusinessDocument.findOneAndUpdate(
      { business: business._id, documentType: data.documentType },
      {
        $set: {
          storageKey: uploaded.public_id,
          storageFormat: uploaded.format || 'pdf',
          documentNumberMasked: maskDocumentNumber(data.documentNumber),
          status: 'PENDING_REVIEW',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: '',
          expiryDate: data.expiryDate || null
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    if (previous?.storageKey) await cloudinary.uploader.destroy(previous.storageKey, { resource_type: 'raw', type: 'authenticated' }).catch(() => {});
    return { success: true, data: publicDocument(doc) };
  } catch (error) {
    await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: 'raw', type: 'authenticated' }).catch(() => {});
    throw error;
  }
};

const listMyDocuments = async (ownerId) => {
  const business = await getBusiness(ownerId);
  const data = await BusinessDocument.find({ business: business._id }).sort({ submittedAt: -1 });
  return { success: true, data: data.map(publicDocument) };
};

const listDocumentsForAdmin = async ({ status = 'PENDING_REVIEW', page = 1, limit = 20 } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const filter = status === 'ALL' ? {} : { status };
  const [documents, total] = await Promise.all([
    BusinessDocument.find(filter).populate('business', 'legalName displayName owner').populate('reviewedBy', 'username email').sort({ submittedAt: 1 })
      .skip((pageNumber - 1) * pageSize).limit(pageSize),
    BusinessDocument.countDocuments(filter)
  ]);
  return { success: true, data: documents.map(publicDocument), total, page: pageNumber, pages: Math.ceil(total / pageSize) };
};

const reviewDocument = async (adminId, id, status, rejectionReason = '') => {
  const doc = await BusinessDocument.findById(id);
  if (!doc) throw fail('Business document not found', 404);
  doc.status = status;
  doc.reviewedBy = adminId;
  doc.reviewedAt = new Date();
  doc.rejectionReason = status === 'REJECTED' ? rejectionReason : '';
  await doc.save();
  return { success: true, data: publicDocument(doc) };
};

const getDocumentDownloadUrl = async ({ ownerId, id, admin = false }) => {
  let query = BusinessDocument.findById(id).select('+storageKey +storageFormat');
  if (!admin) {
    const business = await getBusiness(ownerId);
    query = BusinessDocument.findOne({ _id: id, business: business._id }).select('+storageKey +storageFormat');
  }
  const doc = await query;
  if (!doc) throw fail('Business document not found', 404);
  if (!process.env.CLOUDINARY_API_SECRET) throw fail('Private document storage is not configured', 503);
  const url = cloudinary.utils.private_download_url(doc.storageKey, doc.storageFormat, {
    resource_type: 'raw', type: 'authenticated', attachment: true, expires_at: Math.floor(Date.now() / 1000) + 300
  });
  return { success: true, data: { url, expiresInSeconds: 300 } };
};

const listStaff = async (ownerId) => {
  const business = await getBusiness(ownerId);
  return { success: true, data: await BusinessStaff.find({ business: business._id }).sort({ createdAt: -1 }) };
};

const addStaff = async (ownerId, data) => {
  const business = await getBusiness(ownerId);
  try {
    const staff = await BusinessStaff.create({ business: business._id, name: data.name, email: data.email, role: data.role });
    return { success: true, data: staff };
  } catch (error) {
    if (error.code === 11000) throw fail('A staff member with this email already exists for the business', 409);
    throw error;
  }
};

const updateStaff = async (ownerId, id, data) => {
  const business = await getBusiness(ownerId);
  const allowed = ['name', 'email', 'role', 'status'];
  const update = Object.fromEntries(allowed.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
  try {
    const staff = await BusinessStaff.findOneAndUpdate({ _id: id, business: business._id }, { $set: update }, { new: true, runValidators: true });
    if (!staff) throw fail('Staff member not found', 404);
    return { success: true, data: staff };
  } catch (error) {
    if (error.code === 11000) throw fail('A staff member with this email already exists for the business', 409);
    throw error;
  }
};

const removeStaff = async (ownerId, id) => {
  const business = await getBusiness(ownerId);
  const staff = await BusinessStaff.findOneAndUpdate({ _id: id, business: business._id }, { $set: { status: 'INACTIVE' } }, { new: true });
  if (!staff) throw fail('Staff member not found', 404);
  return { success: true, message: 'Staff member deactivated' };
};

module.exports = { submitDocument, listMyDocuments, listDocumentsForAdmin, reviewDocument, getDocumentDownloadUrl, listStaff, addStaff, updateStaff, removeStaff };
