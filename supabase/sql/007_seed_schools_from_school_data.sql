-- Seed public.schools from the "School data" table (run once in Supabase SQL editor).

with source as (
  select distinct
    trim("EstablishmentName") as name,
    nullif(
      split_part(
        regexp_replace(lower(coalesce("SchoolWebsite", '')), '^https?://(www\\.)?', ''),
        '/',
        1
      ),
      ''
    ) as domain
  from "School data"
  where "EstablishmentName" is not null
    and trim("EstablishmentName") <> ''
),
deduped as (
  select name, domain
  from (
    select
      name,
      domain,
      row_number() over (
        partition by lower(domain)
        order by name
      ) as rn
    from source
    where domain is not null
    union all
    select name, domain, 1 as rn
    from source
    where domain is null
  ) s
  where rn = 1
)
insert into public.schools (name, domain)
select s.name, s.domain
from deduped s
where not exists (
  select 1
  from public.schools p
  where lower(p.name) = lower(s.name)
     or (s.domain is not null and lower(p.domain) = lower(s.domain))
);
