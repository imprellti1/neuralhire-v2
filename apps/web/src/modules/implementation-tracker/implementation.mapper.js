export function mapImplementationStatus(response){ return response?.item || response || { milestones:[], ttv:{dias:0,status:'Critico'} }; }
