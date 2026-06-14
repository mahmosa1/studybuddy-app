import {
  getInstitutionByName,
  getInstitutionByShortName,
  formatInstitutionPickerLabel,
} from '@/constants/academicInstitutions';

export type UserInstitutionData = {
  institutionName?: string | null;
  institutionShortName?: string | null;
  /** @deprecated Legacy field — kept for existing users */
  institution?: string | null;
};

export function buildInstitutionFirestoreFields(selectedName: string): {
  institutionName: string;
  institutionShortName: string;
} {
  const match = getInstitutionByName(selectedName);
  const institutionName = match?.name ?? selectedName.trim();
  return {
    institutionName,
    institutionShortName: match?.shortName ?? '',
  };
}

/** Short label for profile UI — e.g. SCE, BGU */
export function getInstitutionProfileLabel(data: UserInstitutionData): string {
  if (data.institutionShortName?.trim()) {
    return data.institutionShortName.trim();
  }

  const legacyName = data.institutionName?.trim() || data.institution?.trim() || '';
  if (!legacyName) return '';

  const byName = getInstitutionByName(legacyName);
  if (byName) return byName.shortName;

  const byShort = getInstitutionByShortName(legacyName);
  if (byShort) return byShort.shortName;

  return legacyName;
}

/** Full name key for institution-only post visibility matching */
export function getInstitutionMatchKey(data: UserInstitutionData): string {
  return data.institutionName?.trim() || data.institution?.trim() || '';
}

export function formatInstitutionForPost(data: UserInstitutionData): string {
  return getInstitutionMatchKey(data);
}

export function institutionsMatch(userInstitutionKey: string, postInstitution: string): boolean {
  if (!userInstitutionKey || !postInstitution) return false;

  const userKey = userInstitutionKey.trim().toLowerCase();
  const postKey = postInstitution.trim().toLowerCase();
  if (userKey === postKey) return true;

  const userMatch = getInstitutionByName(userKey) || getInstitutionByShortName(userKey);
  const postMatch = getInstitutionByName(postKey) || getInstitutionByShortName(postKey);

  if (userMatch && postMatch) {
    return userMatch.name === postMatch.name;
  }
  if (userMatch) {
    return userMatch.name.toLowerCase() === postKey || userMatch.shortName.toLowerCase() === postKey;
  }
  if (postMatch) {
    return postMatch.name.toLowerCase() === userKey || postMatch.shortName.toLowerCase() === userKey;
  }

  return false;
}

/** Short label for feed/post author line */
export function formatAuthorInstitutionLabel(storedInstitution: string): string {
  if (!storedInstitution.trim()) return '';
  const match =
    getInstitutionByName(storedInstitution) || getInstitutionByShortName(storedInstitution);
  return match ? match.shortName : storedInstitution.trim();
}

export function getInstitutionPickerSummaryLabel(selectedName: string): string {
  const match = getInstitutionByName(selectedName);
  return match ? formatInstitutionPickerLabel(match) : selectedName;
}
