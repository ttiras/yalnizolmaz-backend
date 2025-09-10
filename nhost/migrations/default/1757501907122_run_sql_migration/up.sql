-- Contribution reports
CREATE TABLE public.contribution_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contribution_reports_unique_per_user ON public.contribution_reports (contribution_id, reporter_id);
