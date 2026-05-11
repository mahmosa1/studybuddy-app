export type ParticipationSource = 'lecturer' | 'tutor';

export type ParticipatingCourse = {
  id: string;
  name: string;
  lecturer: string;
  tutorName?: string;
  sources: ParticipationSource[];
};
