export function createInterestLeadDetailsService(apiClient){return{get:(id)=>apiClient.get(`/interest-leads/${id}`),events:(id)=>apiClient.get(`/interest-leads/${id}/events`),patch:(id,payload)=>apiClient.patch(`/interest-leads/${id}`,payload),convert:(id)=>apiClient.post(`/interest-leads/${id}/convert`,{})}}

