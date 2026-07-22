-- Add logistics role to user_role ENUM
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'logistics';

-- Create logistics_profiles table
CREATE TABLE IF NOT EXISTS public.logistics_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    service_areas TEXT[] DEFAULT '{}'::TEXT[],
    vehicle_types TEXT[] DEFAULT '{}'::TEXT[],
    base_rates TEXT,
    certifications TEXT,
    description TEXT,
    contact_info JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, NOW()) NOT NULL
);

-- Create logistics_requests table
CREATE TABLE IF NOT EXISTS public.logistics_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    logistics_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quote_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'rejected', 'completed')),
    user_note TEXT,
    logistics_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.logistics_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_requests ENABLE ROW LEVEL SECURITY;

-- Logistics Profiles Policies
DROP POLICY IF EXISTS "Logistics profiles are viewable by everyone" ON public.logistics_profiles;
CREATE POLICY "Logistics profiles are viewable by everyone" 
    ON public.logistics_profiles FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Logistics can update own profile" ON public.logistics_profiles;
CREATE POLICY "Logistics can update own profile" 
    ON public.logistics_profiles FOR UPDATE 
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Logistics can insert own profile" ON public.logistics_profiles;
CREATE POLICY "Logistics can insert own profile" 
    ON public.logistics_profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Logistics Requests Policies
DROP POLICY IF EXISTS "Users can view requests they sent" ON public.logistics_requests;
CREATE POLICY "Users can view requests they sent" 
    ON public.logistics_requests FOR SELECT 
    USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Logistics can view requests sent to them" ON public.logistics_requests;
CREATE POLICY "Logistics can view requests sent to them" 
    ON public.logistics_requests FOR SELECT 
    USING (auth.uid() = logistics_id);

DROP POLICY IF EXISTS "Users can create requests" ON public.logistics_requests;
CREATE POLICY "Users can create requests" 
    ON public.logistics_requests FOR INSERT 
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Logistics can update requests sent to them (respond)" ON public.logistics_requests;
CREATE POLICY "Logistics can update requests sent to them (respond)" 
    ON public.logistics_requests FOR UPDATE 
    USING (auth.uid() = logistics_id);

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_logistics_profiles_updated_at ON public.logistics_profiles;
CREATE TRIGGER update_logistics_profiles_updated_at BEFORE UPDATE ON public.logistics_profiles 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_logistics_requests_updated_at ON public.logistics_requests;
CREATE TRIGGER update_logistics_requests_updated_at BEFORE UPDATE ON public.logistics_requests 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
