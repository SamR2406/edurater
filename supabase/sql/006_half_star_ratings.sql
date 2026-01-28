-- Allow half-star ratings for review sections.

alter table public.review_sections
  alter column rating type numeric(2,1) using rating::numeric(2,1);

alter table public.review_sections
  drop constraint if exists review_sections_rating_range;

alter table public.review_sections
  add constraint review_sections_rating_range
  check (
    rating is null or (rating >= 1 and rating <= 5 and rating * 2 = floor(rating * 2))
  );
