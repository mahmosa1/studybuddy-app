// lib/upload.ts
import { supabase } from './supabaseClient';

/**
 * העלאת תמונה (תעודת סטודנט / תמונת פרופיל) לסופאבייס
 * מחזירה URL פומבי או null במקרה של שגיאה.
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

    // 2. Blob -> ArrayBuffer (זה היה לנו ועבד, נשאר עם זה)
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    // 3. שם קובץ
    const uriWithoutQuery = uri.split('?')[0];
    const ext = uriWithoutQuery.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    // 4. העלאה ל־bucket studybuddy-files
    const { error } = await supabase.storage
      .from('studybuddy-files')
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.log('Supabase upload error (image):', error);
      return null;
    }

    // 5. החזרת URL פומבי
    const { data: publicData } = supabase.storage
      .from('studybuddy-files')
      .getPublicUrl(filePath);

    return publicData.publicUrl ?? null;
  } catch (err) {
    console.log('Upload exception (image):', err);
    return null;
  }
}

/**
 * העלאת קובץ קורס (PDF / תמונה / וכו') לתיקייה
 * course-files/{courseId}
 */
export async function uploadCourseFileToSupabase(
  uri: string,
  courseId: string,
  mimeType?: string,
): Promise<string | null> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const uriWithoutQuery = uri.split('?')[0];
    const ext = uriWithoutQuery.split('.').pop() || 'bin';
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `course-files/${courseId}/${fileName}`;

    const contentType =
      mimeType ??
      (ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
        ? 'image/png'
        : ext === 'pdf'
        ? 'application/pdf'
        : 'application/octet-stream');

    const { error } = await supabase.storage
      .from('studybuddy-files')
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.log('Supabase upload error (course file):', error);
      return null;
    }

    const { data: publicData } = supabase.storage
      .from('studybuddy-files')
      .getPublicUrl(filePath);

    return publicData.publicUrl ?? null;
  } catch (err) {
    console.log('Upload exception (course file):', err);
    return null;
  }
}

/**
 * ✅ Alias לשם הישן – אם יש עדיין import { uploadCourseFile } בקבצים,
 * זה פשוט יעבוד ויעביר לקריאה ל-uploadCourseFileToSupabase.
 */
export async function uploadCourseFile(
  uri: string,
  courseId: string,
  mimeType?: string,
): Promise<string | null> {
  return uploadCourseFileToSupabase(uri, courseId, mimeType);
}
