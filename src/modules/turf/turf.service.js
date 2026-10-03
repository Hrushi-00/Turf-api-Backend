const Turf = require('./turf.model');
const Booking = require('../booking/booking.model');
const cloudinary = require('../../config/cloudinary');
const Business = require('../business/business.model');

const parseBoolean = (value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAllowedFields = (body) => {
  const allowedFields = ['turfDetails', 'location', 'pricing', 'availability', 'amenities', 'gallery'];
  const turfData = Object.fromEntries(allowedFields
    .filter((field) => body[field] !== undefined)
    .map((field) => [field, body[field]]));

  if (typeof turfData.turfDetails?.sportsAvailable === 'string') {
    try {
      turfData.turfDetails.sportsAvailable = JSON.parse(turfData.turfDetails.sportsAvailable);
    } catch (_) {
      turfData.turfDetails.sportsAvailable = turfData.turfDetails.sportsAvailable.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  if (typeof turfData.amenities === 'string') {
    try {
      turfData.amenities = JSON.parse(turfData.amenities);
    } catch (_) {
      turfData.amenities = turfData.amenities.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return turfData;
};

const uploadGallery = async (files, turfData) => {
  if (!files) return turfData;

  const uploadedImages = [files.mainImage, files.thumbnailImages]
    .filter(Boolean).flatMap((images) => Array.isArray(images) ? images : [images]);
  const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (uploadedImages.some((image) => !allowedImageTypes.has(image.mimetype))) {
    throw Object.assign(new Error('Only JPEG, PNG, and WebP images are allowed'), { statusCode: 400 });
  }
  if (uploadedImages.length > 10) {
    throw Object.assign(new Error('A maximum of 10 images can be uploaded'), { statusCode: 400 });
  }

  if (files.mainImage) {
    const mainImageResult = await cloudinary.uploader.upload(files.mainImage.tempFilePath, {
      folder: 'turfs/main'
    });
    turfData.gallery = turfData.gallery || {};
    turfData.gallery.mainImage = mainImageResult.secure_url;
  }

  if (files.thumbnailImages) {
    const thumbnailImages = Array.isArray(files.thumbnailImages)
      ? files.thumbnailImages
      : [files.thumbnailImages];

    const thumbnailResults = await Promise.all(
      thumbnailImages.map((image) =>
        cloudinary.uploader.upload(image.tempFilePath, { folder: 'turfs/thumbnails' })
      )
    );

    turfData.gallery = turfData.gallery || {};
    turfData.gallery.thumbnailImages = thumbnailResults.map((result) => result.secure_url);
  }

  return turfData;
};

const canAccessTurf = (turf, user) => {
  if (!user) return turf.status === 'active' && turf.metaInfo?.isApproved;
  if (user.role === 'Admin' || user.role === 'SuperAdmin') return true;
  const ownerId = turf.ownerDetails?.businessUserId || turf.ownerDetails?.adminId;
  return String(ownerId) === String(user._id);
};

const publicOwnerFilter = async () => {
  const activeOwners = await Business.find({ approvalStatus: 'APPROVED', subscriptionStatus: 'ACTIVE', operationalStatus: 'ACTIVE' }).distinct('owner');
  return { $or: [
    { 'ownerDetails.businessUserId': { $exists: false } },
    { 'ownerDetails.businessUserId': { $in: activeOwners } }
  ] };
};

const isPublicBusinessTurf = async (turf) => {
  if (!turf.ownerDetails?.businessUserId) return true;
  return !!(await Business.exists({ owner: turf.ownerDetails.businessUserId, approvalStatus: 'APPROVED', subscriptionStatus: 'ACTIVE', operationalStatus: 'ACTIVE' }));
};

const addTurf = async (data) => {
  const { files, user } = data;
  const turfData = getAllowedFields(data.turfData);
  const ownerDetails = {};
  if (user.role === 'BusinessUser') {
    ownerDetails.businessUserId = user._id;
  } else {
    ownerDetails.adminId = user._id;
  }
  ownerDetails.name = user.username;
  ownerDetails.email = user.email;
  ownerDetails.contactNumber = data.turfData.ownerDetails?.contactNumber || user.contactNumber;
  turfData.ownerDetails = ownerDetails;
  if (user.role === 'BusinessUser') {
    const business = await Business.findOne({ owner: user._id });
    if (business?.timezone) turfData.timezone = business.timezone;
  }

  await uploadGallery(files, turfData);
  if (!turfData.gallery?.mainImage) {
    throw Object.assign(new Error('A main image file or gallery.mainImage URL is required'), { statusCode: 400 });
  }

  const turf = await Turf.create(turfData);

  return {
    success: true,
    message: 'Turf created successfully',
    data: turf
  };
};

const getAllTurfs = async (filters) => {
  const { city, sport, q, featured, trending, minPrice, maxPrice, page = 1, limit = 20 } = filters;
  const query = { status: 'active', 'metaInfo.isApproved': true };
  const ownerFilter = await publicOwnerFilter();
  query.$and = [ownerFilter];

  if (city) query['location.city'] = new RegExp(escapeRegExp(city), 'i');
  if (sport) query['turfDetails.sportsAvailable'] = new RegExp(escapeRegExp(sport), 'i');
  if (parseBoolean(featured) !== undefined) query['metaInfo.isFeatured'] = parseBoolean(featured);
  if (parseBoolean(trending) !== undefined) query['metaInfo.isTrending'] = parseBoolean(trending);
  if (q) {
    query.$and.push({ $or: [
      { 'turfDetails.turfName': new RegExp(escapeRegExp(q), 'i') },
      { 'location.city': new RegExp(escapeRegExp(q), 'i') },
      { 'location.address': new RegExp(escapeRegExp(q), 'i') },
      { 'turfDetails.description': new RegExp(escapeRegExp(q), 'i') }
    ] });
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceRange = {};
    if (minPrice !== undefined) priceRange.$gte = Number(minPrice);
    if (maxPrice !== undefined) priceRange.$lte = Number(maxPrice);
    query.$and.push({ $or: [
      { 'pricing.weekdayRate': priceRange },
      { 'pricing.weekendRate': priceRange }
    ] });
  }

  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNumber - 1) * pageSize;

  const [turfs, total] = await Promise.all([
    Turf.find(query).sort({ 'metaInfo.createdAt': -1 }).skip(skip).limit(pageSize),
    Turf.countDocuments(query)
  ]);

  return {
    success: true,
    count: turfs.length,
    total,
    page: pageNumber,
    pages: Math.ceil(total / pageSize),
    data: turfs
  };
};

const getAdminTurfs = async (user) => {
  let query = {};
  if (user.role !== 'Admin' && user.role !== 'SuperAdmin') {
    query = {
      $or: [
        { 'ownerDetails.businessUserId': user._id },
        { 'ownerDetails.adminId': user._id }
      ]
    };
  }

  const turfs = await Turf.find(query).sort({ createdAt: -1 });

  return {
    success: true,
    count: turfs.length,
    data: turfs
  };
};

const getTurf = async (params, user) => {
  const turf = await Turf.findById(params.id);
  if (!turf) {
    throw new Error('Turf not found');
  }

  if (!canAccessTurf(turf, user)) {
    throw new Error('Turf not found');
  }
  if (!user && !(await isPublicBusinessTurf(turf))) throw new Error('Turf not found');

  return {
    success: true,
    data: turf
  };
};

const updateTurf = async (params, user, updateData) => {
  const { id, files } = params;
  const turfData = getAllowedFields(params.turfData || {});
  
  const turf = await Turf.findById(id);
  if (!turf) {
    throw new Error('Turf not found');
  }

  if (!canAccessTurf(turf, user)) {
    throw new Error('You are not allowed to update this turf');
  }
  if (!user && !(await isPublicBusinessTurf(turf))) throw new Error('Turf not found');

  await uploadGallery(files, turfData);

  const updatedTurf = await Turf.findByIdAndUpdate(id, turfData, {
    new: true,
    runValidators: true
  });

  return {
    success: true,
    data: updatedTurf,
    message: 'Turf updated successfully'
  };
};

const updateTurfMetaInfo = async (params, body) => {
  const { id } = params;
  if (body.isApproved === true) {
    const targetTurf = await Turf.findById(id).select('ownerDetails');
    if (!targetTurf) throw Object.assign(new Error('Turf not found'), { statusCode: 404 });
    if (targetTurf.ownerDetails?.businessUserId) {
      const business = await Business.findOne({ owner: targetTurf.ownerDetails.businessUserId });
      if (!business || business.approvalStatus !== 'APPROVED') {
        throw Object.assign(new Error('Business profile must be approved before approving this turf'), { statusCode: 409 });
      }
    }
  }
  const allowedUpdates = ['isApproved', 'isFeatured', 'isTrending', 'popularityScore'];
  const updates = {};

  for (const key of allowedUpdates) {
    if (body[key] !== undefined) {
      updates[`metaInfo.${key}`] = body[key];
    }
  }
  if (body.isApproved === true) updates.status = 'active';
  if (body.isApproved === false) updates.status = 'pending';

  const turf = await Turf.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!turf) {
    throw new Error('Turf not found');
  }

  return {
    success: true,
    data: turf.metaInfo,
    message: 'Turf meta info updated successfully'
  };
};

const deleteTurf = async (params, user) => {
  const { id } = params;
  const turf = await Turf.findById(id);
  if (!turf) {
    throw new Error('Turf not found');
  }

  if (!canAccessTurf(turf, user)) {
    throw new Error('You are not allowed to delete this turf');
  }

  const hasBookings = await Booking.exists({ turf: turf._id });
  if (hasBookings) {
    throw Object.assign(new Error('This turf has booking history and cannot be deleted'), { statusCode: 409 });
  }

  await turf.deleteOne();

  return {
    success: true,
    message: 'Turf deleted successfully'
  };
};

const getBookingStats = async (user) => {
  const match =
    user.role === 'Admin' || user.role === 'SuperAdmin'
      ? {}
      : { admin: user._id };

  const stats = await Booking.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$price' },
        paidBookings: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
        },
        pendingBookings: {
          $sum: { $cond: [{ $eq: ['$bookingStatus', 'pending'] }, 1, 0] }
        }
      }
    }
  ]);

  return {
    success: true,
    data: stats[0] || {
      totalBookings: 0,
      totalRevenue: 0,
      paidBookings: 0,
      pendingBookings: 0
    }
  };
};

const approveTurf = async (id) => {
  const pendingTurf = await Turf.findById(id).select('ownerDetails');
  if (!pendingTurf) throw new Error('Turf not found');
  if (pendingTurf.ownerDetails?.businessUserId) {
    const business = await Business.findOne({ owner: pendingTurf.ownerDetails.businessUserId });
    if (!business || business.approvalStatus !== 'APPROVED') {
      throw Object.assign(new Error('Business profile must be approved before approving this turf'), { statusCode: 409 });
    }
  }
  const turf = await Turf.findByIdAndUpdate(
    id,
    {
      status: 'active',
      'metaInfo.isApproved': true
    },
    { new: true }
  );

  if (!turf) {
    throw new Error('Turf not found');
  }

  return {
    success: true,
    data: turf,
    message: 'Turf approved successfully'
  };
};

const rejectTurf = async (id) => {
  const turf = await Turf.findByIdAndUpdate(
    id,
    {
      status: 'rejected',
      'metaInfo.isApproved': false
    },
    { new: true }
  );

  if (!turf) {
    throw new Error('Turf not found');
  }

  return {
    success: true,
    data: turf,
    message: 'Turf rejected successfully'
  };
};

const getFeaturedTurfs = async () => {
  const turfs = await Turf.find({
    status: 'active',
    'metaInfo.isApproved': true,
    'metaInfo.isFeatured': true,
    ...(await publicOwnerFilter())
  }).sort({ 'metaInfo.popularityScore': -1 });

  return { success: true, count: turfs.length, data: turfs };
};

const getTrendingTurfs = async () => {
  const turfs = await Turf.find({
    status: 'active',
    'metaInfo.isApproved': true,
    'metaInfo.isTrending': true,
    ...(await publicOwnerFilter())
  }).sort({ 'metaInfo.popularityScore': -1 });

  return { success: true, count: turfs.length, data: turfs };
};

const getApprovedTurfs = async () => {
  const turfs = await Turf.find({ status: 'active', 'metaInfo.isApproved': true, ...(await publicOwnerFilter()) });
  return {
    success: true,
    count: turfs.length,
    data: turfs
  };
};

const getTurfAvailability = async (params, user) => {
  const { id, date } = params;
  const turf = await Turf.findById(id).select('availability pricing turfDetails location status metaInfo ownerDetails');
  if (!turf) {
    throw new Error('Turf not found');
  }

  if (!canAccessTurf(turf, user)) {
    throw new Error('Turf not found');
  }
  if (!user && !(await isPublicBusinessTurf(turf))) throw new Error('Turf not found');

  let bookedSlots = [];

  if (date) {
    const bookingDate = new Date(`${new Date(date).toISOString().slice(0, 10)}T00:00:00.000Z`);
    const nextDate = new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000);
    bookedSlots = await Booking.find({
      turf: turf._id,
      date: { $gte: bookingDate, $lt: nextDate },
      $or: [
        { bookingStatus: 'confirmed' },
        { bookingStatus: 'pending', $or: [{ holdExpiresAt: { $gt: new Date() } }, { holdExpiresAt: { $exists: false } }] }
      ]
    }).select('timeSlot bookingStatus paymentStatus');
  }

  return {
    success: true,
    data: {
      turf,
      bookedSlots
    }
  };
};

module.exports = {
  addTurf,
  getAllTurfs,
  getAdminTurfs,
  getTurf,
  updateTurf,
  updateTurfMetaInfo,
  deleteTurf,
  getBookingStats,
  approveTurf,
  rejectTurf,
  getFeaturedTurfs,
  getTrendingTurfs,
  getApprovedTurfs,
  getTurfAvailability
};
