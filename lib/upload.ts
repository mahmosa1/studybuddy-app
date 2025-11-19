import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

export async function uploadFile(uri: string, folder: string) {
  try {
    // Convert file to base64 manually
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });

    // Create file name
    const fileName = `${folder}/${Date.now()}.jpg`;

    // Upload to Supabase bucket
    const { data, error } = await supabase.storage
      .from('studybuddy-files')
      .upload(fileName, Buffer.from(base64, 'base64'), {
        contentType: 'image/jpeg',
      });

    if (error) throw error;

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('studybuddy-files')
      .getPublicUrl(fileName);

    return publicData.publicUrl;

  } catch (err) {
    console.log("Upload error:", err);
    return null;
  }
}
