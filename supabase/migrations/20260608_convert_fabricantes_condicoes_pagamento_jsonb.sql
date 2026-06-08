alter table public.fabricantes
  alter column condicoes_pagamento type jsonb
  using case
    when condicoes_pagamento is null or btrim(condicoes_pagamento::text) = '' then '[]'::jsonb
    else condicoes_pagamento::jsonb
  end;

alter table public.fabricantes
  alter column condicoes_pagamento set default '[]'::jsonb;
