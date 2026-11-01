-- Proposed database changes for the shared Supabase project.
-- NOT APPLIED. Review, then run in the Supabase SQL editor or add to the
-- migrations in livestock-command-center. Sections are independent.

-- ============================================================================
-- 1. Find a Vet: lets a farmer see who they can book.
-- ============================================================================
-- profiles and user_roles are private to each user, so a farmer can't list vets
-- (the web app's useVetProfiles returns nothing for a farmer for the same reason).
-- SECURITY DEFINER reads across users; only name and rating leave the function,
-- never email or phone. Additive and idempotent. The app uses it as soon as it
-- exists, and keeps the seeded list until then.

CREATE OR REPLACE FUNCTION public.get_bookable_vets()
RETURNS TABLE (user_id uuid, full_name text, rating numeric, reviews bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         p.full_name,
         COALESCE(ROUND(AVG(r.rating), 2), 0) AS rating,
         COUNT(r.id) AS reviews
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  LEFT JOIN public.vet_service_ratings r ON r.vet_id = ur.user_id
  WHERE ur.role = 'veterinary'::app_role
    AND p.full_name IS NOT NULL
  GROUP BY p.user_id, p.full_name
  ORDER BY rating DESC, p.full_name;
$$;

REVOKE ALL ON FUNCTION public.get_bookable_vets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bookable_vets() TO authenticated;

-- ============================================================================
-- 2. Herd privacy: limits farmers to their own animals. REVIEW BEFORE RUNNING.
-- ============================================================================
-- The policies in the migrations have no ownership check: any farmer can read and
-- update EVERY farmer's animals, and livestock_audit_log has the same read rule.
-- On the tablet the Kabwohe farmer does see animals on other account numbers
-- (000001-001). The live policies may differ from the migrations (a farmer's
-- INSERT works, though no migration allows it), so check them first:
--
--   SELECT policyname, cmd, qual, with_check FROM pg_policies
--   WHERE tablename = 'animal_lineage';
--
-- This section is commented out because it hides any existing row that has
-- neither owner column set from every farmer. See how many there are:
--
--   SELECT count(*) FROM public.animal_lineage
--   WHERE farmer_id IS NULL AND assigned_farmer_id IS NULL;
--
-- A vet-captured animal awaiting the farmer's confirmation needs its owner column
-- set, or that farmer won't see it either.
--
-- DROP POLICY "Farmers can view animal_lineage" ON public.animal_lineage;
-- CREATE POLICY "Farmers can view own animal_lineage"
--   ON public.animal_lineage FOR SELECT TO authenticated
--   USING (
--     public.has_role(auth.uid(), 'farmer'::app_role)
--     AND auth.uid() IN (farmer_id, assigned_farmer_id)
--   );
--
-- DROP POLICY "Farmers can update animal_lineage" ON public.animal_lineage;
-- CREATE POLICY "Farmers can update own animal_lineage"
--   ON public.animal_lineage FOR UPDATE TO authenticated
--   USING (
--     public.has_role(auth.uid(), 'farmer'::app_role)
--     AND auth.uid() IN (farmer_id, assigned_farmer_id)
--   )
--   WITH CHECK (
--     public.has_role(auth.uid(), 'farmer'::app_role)
--     AND auth.uid() IN (farmer_id, assigned_farmer_id)
--   );
