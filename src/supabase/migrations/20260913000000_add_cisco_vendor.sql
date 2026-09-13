-- Migration: Add Cisco vendor to public.vendors table
-- Description: Seeds Cisco vendor record with default schedule

INSERT INTO public.vendors (code, name, icon_url, homepage, is_active, schedule_enabled, schedule_times, schedule_timezone)
VALUES
    ('cisco', 'Cisco', 'https://www.cisco.com/favicon.ico', 'https://sec.cloudapps.cisco.com/security/center/publicationListing.x', true, false, ARRAY['08:00','12:30','18:30'], 'Asia/Taipei')
ON CONFLICT (code) DO NOTHING;
