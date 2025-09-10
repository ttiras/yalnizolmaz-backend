CREATE TABLE public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,       -- short code or free text
  details text,               -- optional long text
  status text NOT NULL DEFAULT 'pending',  -- pending|reviewed|action_taken|dismissed
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX post_reports_unique_per_user ON public.post_reports (post_id, reporter_id);
