export type AcademicInstitution = {
  name: string;
  shortName: string;
};

export const ACADEMIC_INSTITUTIONS: AcademicInstitution[] = [
  { name: 'Ben-Gurion University of the Negev', shortName: 'BGU' },
  { name: 'Tel Aviv University', shortName: 'TAU' },
  { name: 'The Hebrew University of Jerusalem', shortName: 'HUJI' },
  { name: 'Technion – Israel Institute of Technology', shortName: 'Technion' },
  { name: 'Bar-Ilan University', shortName: 'BIU' },
  { name: 'University of Haifa', shortName: 'UHaifa' },
  { name: 'Ariel University', shortName: 'AU' },
  { name: 'Sami Shamoon College of Engineering', shortName: 'SCE' },
];

export function getInstitutionByName(name: string): AcademicInstitution | undefined {
  const normalized = name.trim().toLowerCase();
  return ACADEMIC_INSTITUTIONS.find((institution) => institution.name.toLowerCase() === normalized);
}

export function getInstitutionByShortName(shortName: string): AcademicInstitution | undefined {
  const normalized = shortName.trim().toLowerCase();
  return ACADEMIC_INSTITUTIONS.find((institution) => institution.shortName.toLowerCase() === normalized);
}

export function formatInstitutionPickerLabel(institution: AcademicInstitution): string {
  return `${institution.shortName} — ${institution.name}`;
}
