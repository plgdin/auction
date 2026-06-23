CREATE TABLE IF NOT EXISTS user_recommendation_profiles (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    preferences JSONB,
    recent_searches JSONB NOT NULL DEFAULT '[]'::jsonb,
    questionnaire_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_recommendation_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendation profile"
    ON user_recommendation_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendation profile"
    ON user_recommendation_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendation profile"
    ON user_recommendation_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_recommendation_profiles_updated_at
    BEFORE UPDATE ON user_recommendation_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
