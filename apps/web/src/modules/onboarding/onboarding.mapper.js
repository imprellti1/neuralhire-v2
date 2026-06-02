export function mapOnboarding(res){ return res?.item || { status:'not_started', current_step:'welcome', completed_steps:[] }; }
