import { supabaseAdmin } from '../config/supabase';

export class SettingsRepository {
  /**
   * Get a setting value by key.
   */
  async getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching setting:', error);
      return null;
    }

    return data?.value ?? null;
  }

  /**
   * Set a setting value (upsert).
   */
  async setSetting(key: string, value: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('app_settings')
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Error saving setting:', error);
      return false;
    }
    return true;
  }

  /**
   * Get the salary_only filter setting.
   */
  async getSalaryOnly(): Promise<boolean> {
    const value = await this.getSetting('salary_only');
    return value === 'true';
  }

  /**
   * Set the salary_only filter setting.
   */
  async setSalaryOnly(enabled: boolean): Promise<boolean> {
    return this.setSetting('salary_only', String(enabled));
  }
}
