-- Drop any existing triggers on blogs table to prevent duplication
DO $$
DECLARE
    trig RECORD;
BEGIN
    FOR trig IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'blogs'
        AND trigger_name != 'update_blogs_updated_at_trigger'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trig.trigger_name || ' ON public.blogs;';
    END LOOP;
END $$;

-- Create or replace function to generate a clean, SEO-friendly slug
CREATE OR REPLACE FUNCTION public.generate_blog_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Lowercase, replace special chars and spaces with hyphens, trim consecutive or trailing hyphens
    NEW.slug := regexp_replace(
        regexp_replace(
            lower(NEW.title),
            '[^a-z0-9]+',
            '-',
            'g'
        ),
        '^-+|-+$',
        '',
        'g'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind the trigger to run BEFORE INSERT or BEFORE UPDATE of the title
CREATE TRIGGER generate_blog_slug_trigger
BEFORE INSERT OR UPDATE OF title ON public.blogs
FOR EACH ROW
EXECUTE FUNCTION public.generate_blog_slug();

-- Force slug update on existing blogs
UPDATE public.blogs SET title = title;
