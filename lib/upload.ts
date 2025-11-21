// lib/upload.ts
import { supabase } from './supabaseClient';

/**
 * Upload local image (from ImagePicker) to Supabase Storage
 * and return public URL (or null on error).
 *
 * folder:
 *  - 'student-cards'
 *  - 'profile-pictures'
 */
export async function uploadImageToSupabase(
  uri: string,
  folder: 'student-cards' | 'profile-pictures',
): Promise<string | null> {
  try {
    // 1. מושכים את הקובץ מה-URI המקומי (file://...)
    const response = await fetch(uri);

    // 2. ממירים ל-Blob ואז ל-ArrayBuffer (פורמט שב-Supabase אוהב)
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    // 3. מייצרים שם קובץ ותיקייה מתאימה
    const ext = uri.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    // 4. מעלים ל-bucket בשם studybuddy-files
    const { data, error } = await supabase.storage
      .from('studybuddy-files')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.log('Supabase upload error:', error);
      return null;
    }

    // 5. מחזירים URL פומבי
    const { data: publicData } = supabase.storage
      .from('studybuddy-files')
      .getPublicUrl(filePath);

    return publicData.publicUrl ?? null;
  } catch (err) {
    console.log('Upload exception:', err);
    return null;
  }
}
