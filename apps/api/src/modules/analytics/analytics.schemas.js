export const analyticsPeriodSchema = {
  startDate: { required: false, type: 'string', maxLength: 40 },
  endDate: { required: false, type: 'string', maxLength: 40 },
  limit: { required: false, type: 'number' }
};
