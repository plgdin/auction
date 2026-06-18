import { supabase } from '../lib/supabase';
import type { Profile, Organization } from '../types/database.types';
import { logUserActivity } from './auditService';

export const authService = {
  // --------------------------------------------------------
  // SUPABASE AUTHENTICATION
  // --------------------------------------------------------

  async signUp(email: string, password: string, firstName: string, lastName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    if (error) throw error;
    if (data.user) {
      logUserActivity('user_register', 'profile', data.user.id, { email, firstName, lastName });
    }
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.user) {
      logUserActivity('user_login', 'profile', data.user.id, { email });
    }
    return data;
  },

  async signOut() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logUserActivity('user_logout', 'profile', user.id, { email: user.email });
      }
    } catch (e) {
      // Ignore user fetching error on signout
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPasswordForEmail(email: string, redirectTo: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  },

  async updateUserPassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
      password,
    });
    if (error) throw error;
    return data;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  // --------------------------------------------------------
  // PROFILES & ORGANIZATIONS
  // --------------------------------------------------------

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }
    return data;
  },

  async getOrganization(orgId: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (error) {
      console.error('Error fetching organization:', error);
      return null;
    }
    return data;
  },

  async createOrganization(orgData: Partial<Organization>): Promise<Organization | null> {
    const { data, error } = await supabase
      .from('organizations')
      .insert([orgData])
      .select()
      .single();

    if (error) {
      console.error('Error creating organization:', error);
      return null;
    }
    return data;
  }
};
