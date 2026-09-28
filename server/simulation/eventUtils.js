const { REGION_TYPES } = require('./scenarioSchema');

/** Last day event is active: startDay <= day < startDay + durationDays → end exclusive at startDay + durationDays */
function getEventEndDay(event) {
  return event.startDay + event.durationDays;
}

function isEventActive(event, day) {
  return day >= event.startDay && day < getEventEndDay(event);
}

/**
 * Region-scoped event multipliers on day `day`. supplyDisruption events are supplier-scoped and
 * handled in supplyNetwork.js (the generator adds eventFactors.supplyByWarehouse).
 */
function computeEventFactors(scenario, day) {
  const demand = { urban: 1, suburban: 1, rural: 1 };
  const transit = { urban: 1, suburban: 1, rural: 1 };
  const lead = { urban: 1, suburban: 1, rural: 1 };

  for (const ev of scenario.events || []) {
    if (!isEventActive(ev, day) || ev.type === 'supplyDisruption') continue;
    const targets = ev.targetRegions || REGION_TYPES;
    for (const rt of targets) {
      if (!REGION_TYPES.includes(rt)) continue;
      if (ev.type === 'demandSurge') demand[rt] *= ev.magnitude;
      if (ev.type === 'roadDisruption') transit[rt] *= ev.magnitude;
      if (ev.type === 'leadTimeExtension') lead[rt] *= ev.magnitude;
    }
  }
  return { demand, transit, lead, supplyByWarehouse: {} };
}

function lastEventEndDay(scenario) {
  if (!scenario?.events?.length) return -1;
  return Math.max(...scenario.events.map(getEventEndDay));
}

module.exports = {
  getEventEndDay,
  isEventActive,
  computeEventFactors,
  lastEventEndDay,
};
