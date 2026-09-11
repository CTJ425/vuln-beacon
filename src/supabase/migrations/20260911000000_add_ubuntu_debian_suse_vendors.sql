-- Migration: Add Ubuntu, Debian, and SUSE vendors to public.vendors table
-- Description: Seeds Ubuntu, Debian, and SUSE vendor records with default schedules

INSERT INTO public.vendors (code, name, icon_url, homepage, is_active, schedule_enabled, schedule_times, schedule_timezone)
VALUES
    ('ubuntu', 'Ubuntu', 'https://assets.ubuntu.com/v1/49a1a858-favicon-32x32.png', 'https://ubuntu.com/security', true, false, ARRAY['08:00','12:30','18:30'], 'Asia/Taipei'),
    ('debian', 'Debian', 'https://www.debian.org/favicon.ico', 'https://www.debian.org/security/', true, false, ARRAY['08:00','12:30','18:30'], 'Asia/Taipei'),
    ('suse', 'SUSE', 'https://www.suse.com/favicon.ico', 'https://www.suse.com/security/', true, false, ARRAY['08:00','12:30','18:30'], 'Asia/Taipei')
ON CONFLICT (code) DO NOTHING;
