/**
 * Keep research-result requests bound to the job the user still has selected.
 */
function nextRequestGeneration(current) {
  return Number(current || 0) + 1;
}

function shouldApplyJobResponse(request, current) {
  if (!request || !current) return false;
  return request.jobId === current.jobId
    && Number(request.page) === Number(current.page)
    && Number(request.gen) === Number(current.gen);
}

function bindAfterJobSwitch(jobId) {
  return {
    jobId: jobId || null,
    results: [],
    trace: null,
    page: 1,
  };
}

module.exports = { nextRequestGeneration, shouldApplyJobResponse, bindAfterJobSwitch };
