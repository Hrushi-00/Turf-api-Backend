require('dotenv').config();
const mongoose = require('mongoose');
const Turf = require('../src/modules/turf/turf.model');
const Business = require('../src/modules/business/business.model');
const Location = require('../src/modules/locations/location.model');
const Venue = require('../src/modules/venues/venue.model');
const Facility = require('../src/modules/venues/facility.model');
const FacilityAvailability = require('../src/modules/venues/facility-availability.model');
const Sport = require('../src/modules/sports/sport.model');

const slugify = (value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const migrate = async () => {
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is required');
  await mongoose.connect(process.env.MONGO_URL);
  const apply = process.argv.includes('--apply');
  const turfs = await Turf.find({ 'ownerDetails.businessUserId': { $exists: true, $ne: null } }).sort({ _id: 1 });
  const owners = [...new Set(turfs.map((turf) => String(turf.ownerDetails.businessUserId)))];
  const businesses = await Business.find({ owner: { $in: owners } });
  const businessByOwner = new Map(businesses.map((business) => [String(business.owner), business]));
  const activeSports = await Sport.find({ status: 'ACTIVE' }).select('slug');
  const activeSportSlugs = new Set(activeSports.map((sport) => sport.slug));
  const skipped = [];
  let migrated = 0;

  for (const turf of turfs) {
    const sourceId = String(turf._id);
    const business = businessByOwner.get(String(turf.ownerDetails.businessUserId));
    if (!business) { skipped.push({ turfId: sourceId, reason: 'BUSINESS_PROFILE_MISSING' }); continue; }
    const sportSlugs = [...new Set((turf.turfDetails.sportsAvailable || []).map(slugify).filter(Boolean))];
    if (!sportSlugs.length || sportSlugs.some((slug) => !activeSportSlugs.has(slug))) {
      skipped.push({ turfId: sourceId, reason: 'SPORT_MASTER_MAPPING_REQUIRED' });
      continue;
    }
    if (!apply) { migrated += 1; continue; }

    let location = await Location.findOne({ legacyTurf: turf._id });
    if (!location) {
      location = await Location.create({
        business: business._id,
        legacyTurf: turf._id,
        name: turf.turfDetails.turfName,
        address: turf.location.address,
        landmark: turf.location.landmark || '',
        city: turf.location.city,
        state: turf.location.state,
        country: business.address.country,
        postalCode: turf.location.zipCode,
        timezone: turf.timezone || business.timezone,
        status: turf.status === 'active' ? 'ACTIVE' : 'INACTIVE'
      });
    }

    let venue = await Venue.findOne({ legacyTurf: turf._id });
    if (!venue) {
      venue = await Venue.create({
        business: business._id,
        location: location._id,
        legacyTurf: turf._id,
        name: turf.turfDetails.turfName,
        description: turf.turfDetails.description || turf.turfDetails.turfName,
        media: [turf.gallery?.mainImage, ...(turf.gallery?.thumbnailImages || [])].filter(Boolean),
        amenities: turf.amenities || [],
        contactPhone: turf.ownerDetails.contactNumber || '',
        approvalStatus: turf.status === 'active' && turf.metaInfo?.isApproved ? 'APPROVED' : 'PENDING',
        operationalStatus: turf.status === 'active' ? 'ACTIVE' : 'PAUSED'
      });
    }

    const schedule = weekdays.map((day, dayOfWeek) => ({
      dayOfWeek,
      isClosed: (turf.availability?.closedDays || []).some((closedDay) => closedDay.toLowerCase() === day),
      openTime: turf.availability?.openingTime,
      closeTime: turf.availability?.closingTime
    }));
    await Facility.updateOne({ legacyTurf: turf._id }, { $setOnInsert: {
      venue: venue._id,
      legacyTurf: turf._id,
      name: turf.turfDetails.turfName,
      sportSlugs,
      surfaceType: turf.turfDetails.surfaceType || '',
      capacity: turf.turfDetails.capacity || 1,
      description: turf.turfDetails.description || '',
      amenities: turf.amenities || [],
      weeklySchedule: schedule,
      pricing: {
        currency: turf.pricing.currency || 'INR',
        weekdayRate: turf.pricing.weekdayRate,
        weekendRate: turf.pricing.weekendRate,
        minimumBookingMinutes: Math.max(15, (turf.pricing.minimumBookingHours || 1) * 60)
      },
      status: turf.status === 'active' ? 'ACTIVE' : 'INACTIVE'
    } }, { upsert: true });
    const mappedFacility = await Facility.findOne({ legacyTurf: turf._id }).select('_id');
    for (const blockedDate of turf.availability?.customUnavailableDates || []) {
      const date = new Date(`${new Date(blockedDate).toISOString().slice(0, 10)}T00:00:00.000Z`);
      await FacilityAvailability.updateOne({ facility: mappedFacility._id, date }, {
        $setOnInsert: { type: 'CLOSED', reason: 'Migrated from legacy Turf unavailable dates' }
      }, { upsert: true });
    }
    migrated += 1;
  }

  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', candidates: turfs.length, migrated, skipped }, null, 2));
};

migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});
