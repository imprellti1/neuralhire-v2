import { getCustomerSuccessTimeline } from './customer-success-timeline.repository.js';
export async function getCustomerSuccessTimelineHandler(ctx){ return getCustomerSuccessTimeline(ctx.params?.accountId); }
