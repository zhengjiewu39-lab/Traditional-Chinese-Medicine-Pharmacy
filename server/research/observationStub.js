/**
 * Reserved Observation shape for a future MedWear link.
 * Not FHIR-certified. Integration stays disabled until a real interface exists.
 */
function observationTemplate() {
  return {
    resourceType: 'Observation',
    interoperability: 'not_verified',
    patientRef: null,
    code: null,
    value: null,
    unit: null,
    effectiveDateTime: null,
    device: null,
    quality: 'unknown',
    authorizationScope: null,
    simulated: true,
    enabled: false,
  };
}

module.exports = { observationTemplate };
