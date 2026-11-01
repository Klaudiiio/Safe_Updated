BEGIN;

ALTER TABLE public.incident
    ADD COLUMN IF NOT EXISTS location_description text;

INSERT INTO public.incident_types (incident_name, priority_level, description)
VALUES
    ('Cardiac Arrest / Collapse', 'URGENT', 'Unconscious, not breathing normally, no pulse'),
    ('Severe Difficulty Breathing', 'URGENT', 'Asthma attack, choking, turning blue'),
    ('Seizure Lasting >5 Minutes', 'URGENT', 'Repeated seizures or not waking up afterward'),
    ('Anaphylaxis (Severe Allergy)', 'URGENT', 'Swollen throat, wheezing, collapse after food, sting, or medicine'),
    ('Severe Bleeding', 'URGENT', 'Blood soaking clothing or spurting from a wound'),
    ('Unconscious / Unresponsive Student', 'URGENT', 'Fainting that does not resolve quickly'),
    ('Suspected Stroke', 'URGENT', 'Face drooping, arm weakness, speech difficulty'),
    ('Major Head or Neck Injury', 'URGENT', 'Fall from height, sports collision, possible spinal injury'),
    ('Severe Burns', 'URGENT', 'Electrical burns, large-area burns, facial burns'),
    ('Poisoning / Overdose', 'URGENT', 'Ingesting chemicals, medications, or unknown substances'),
    ('Small Cuts or Abrasions', 'MINOR', 'Clean and bandage'),
    ('Minor Sprain or Strain', 'MINOR', 'Rest, ice, compression'),
    ('Brief Dizziness', 'MINOR', 'Hydration and observation'),
    ('Mild Fever', 'MINOR', 'Clinic assessment'),
    ('Headache', 'MINOR', 'Rest and evaluation'),
    ('Stomachache / Nausea', 'MINOR', 'Observe and hydrate'),
    ('Nosebleed', 'MINOR', 'First aid and monitoring'),
    ('Minor Allergic Rash', 'MINOR', 'Monitor for worsening symptoms'),
    ('Small Bruise', 'MINOR', 'Ice pack and rest'),
    ('Mild Dehydration', 'MINOR', 'Fluids and observation')
ON CONFLICT (incident_name) DO NOTHING;

GRANT USAGE ON SCHEMA public TO authenticated;
REVOKE ALL ON TABLE
    public."user",
    public.incident_types,
    public.incident,
    public.location,
    public.notification,
    public.responder_notification,
    public.responder,
    public.admin,
    public.logs
FROM anon, authenticated;

GRANT SELECT ON TABLE
    public."user",
    public.incident_types,
    public.incident,
    public.location,
    public.notification,
    public.responder_notification,
    public.responder,
    public.admin,
    public.logs
TO authenticated;
GRANT INSERT ON TABLE public.incident TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.incident_incident_id_seq TO authenticated;

DROP POLICY IF EXISTS "Client reads incident types" ON public.incident_types;
CREATE POLICY "Client reads incident types"
    ON public.incident_types FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Client reads locations" ON public.location;
CREATE POLICY "Client reads locations"
    ON public.location FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users read own profile and admins read all profiles" ON public."user";
CREATE POLICY "Users read own profile and admins read all profiles"
    ON public."user" FOR SELECT TO authenticated
    USING (
        user_id::text = (auth.jwt() ->> 'sub')
        OR (auth.jwt() ->> 'app_role') = 'admin'
    );

DROP POLICY IF EXISTS "Users read own incidents and admins read all incidents" ON public.incident;
CREATE POLICY "Users read own incidents and admins read all incidents"
    ON public.incident FOR SELECT TO authenticated
    USING (
        user_id::text = (auth.jwt() ->> 'sub')
        OR (auth.jwt() ->> 'app_role') = 'admin'
    );

DROP POLICY IF EXISTS "Users submit own pending incidents" ON public.incident;
CREATE POLICY "Users submit own pending incidents"
    ON public.incident FOR INSERT TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'app_role') = 'user'
        AND user_id::text = (auth.jwt() ->> 'sub')
        AND upper(status) = 'PENDING'
    );

DROP POLICY IF EXISTS "Admins read notifications" ON public.notification;
CREATE POLICY "Admins read notifications"
    ON public.notification FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'admin');

DROP POLICY IF EXISTS "Admins read responder assignments" ON public.responder_notification;
CREATE POLICY "Admins read responder assignments"
    ON public.responder_notification FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'admin');

DROP POLICY IF EXISTS "Admins read responders" ON public.responder;
CREATE POLICY "Admins read responders"
    ON public.responder FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'admin');

DROP POLICY IF EXISTS "Admins read admin records" ON public.admin;
CREATE POLICY "Admins read admin records"
    ON public.admin FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'admin');

DROP POLICY IF EXISTS "Admins read logs" ON public.logs;
CREATE POLICY "Admins read logs"
    ON public.logs FOR SELECT TO authenticated
    USING ((auth.jwt() ->> 'app_role') = 'admin');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'incident'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.incident';
    END IF;
END;
$$;

COMMIT;
