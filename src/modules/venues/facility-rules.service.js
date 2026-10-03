const FacilityAvailability = require('./facility-availability.model');
const FacilityPricingRule = require('./facility-pricing-rule.model');

const toMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const getDateRules = async (facilityId, date) => {
  const day = new Date(`${date}T00:00:00.000Z`);
  const [availability, pricingRules] = await Promise.all([
    FacilityAvailability.findOne({ facility: facilityId, date: day }),
    FacilityPricingRule.find({ facility: facilityId, status: 'ACTIVE' }).sort({ priority: -1, createdAt: 1 })
  ]);
  return { day, dayOfWeek: day.getUTCDay(), availability, pricingRules };
};

const resolveSchedule = (facility, dayOfWeek, exception) => {
  if (exception?.type === 'CLOSED') return { isClosed: true, openTime: null, closeTime: null };
  if (exception?.type === 'OVERRIDE') return { isClosed: false, openTime: exception.openTime, closeTime: exception.closeTime };
  const weekly = facility.weeklySchedule.find((entry) => entry.dayOfWeek === dayOfWeek);
  return { isClosed: !weekly || weekly.isClosed, openTime: weekly?.openTime || null, closeTime: weekly?.closeTime || null };
};

const overlapsWindow = (slot, window) => toMinutes(slot.start) < toMinutes(window.endTime) && toMinutes(window.start) < toMinutes(slot.end);

const resolveHourlyRate = (facility, date, dayOfWeek, slotStartMinute, rules = []) => {
  const dateString = date.slice(0, 10);
  const rule = rules.find((item) => {
    const startsAt = item.effectiveFrom?.toISOString().slice(0, 10);
    const endsAt = item.effectiveTo?.toISOString().slice(0, 10);
    return (!item.daysOfWeek.length || item.daysOfWeek.includes(dayOfWeek)) &&
      slotStartMinute >= toMinutes(item.startTime) && slotStartMinute < toMinutes(item.endTime) &&
      (!startsAt || dateString >= startsAt) && (!endsAt || dateString <= endsAt);
  });
  if (rule) return rule.hourlyRate;
  return dayOfWeek === 0 || dayOfWeek === 6 ? facility.pricing.weekendRate : facility.pricing.weekdayRate;
};

const resolveRateDetails = (facility, date, dayOfWeek, slotStartMinute, rules = []) => {
  const dateString = date.slice(0, 10);
  const rule = rules.find((item) => {
    const startsAt = item.effectiveFrom?.toISOString().slice(0, 10);
    const endsAt = item.effectiveTo?.toISOString().slice(0, 10);
    return (!item.daysOfWeek.length || item.daysOfWeek.includes(dayOfWeek)) &&
      slotStartMinute >= toMinutes(item.startTime) && slotStartMinute < toMinutes(item.endTime) &&
      (!startsAt || dateString >= startsAt) && (!endsAt || dateString <= endsAt);
  });
  return rule
    ? { hourlyRate: rule.hourlyRate, pricingRuleId: rule._id, pricingRuleName: rule.name }
    : { hourlyRate: dayOfWeek === 0 || dayOfWeek === 6 ? facility.pricing.weekendRate : facility.pricing.weekdayRate, pricingRuleName: '' };
};

module.exports = { getDateRules, resolveSchedule, overlapsWindow, resolveHourlyRate, resolveRateDetails, toMinutes };
