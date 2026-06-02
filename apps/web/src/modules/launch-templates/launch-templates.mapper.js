export const mapLaunchTemplate=(x={})=>({id:x.id,name:x.name||'-',channel:x.channel||'email',status:x.status||'draft',subject:x.subject||'',body:x.body||'',updatedAt:x.updated_at||x.updatedAt||''});
export const mapPreview=(x={})=>({subject:x.subject||'',body:x.body||''});
