export interface Word {
  id: number;
  english: string;
  pos: string; // Part of speech
  chinese: string;
}

export interface WordStats {
  wordId: number;
  box: number; // Leitner box (0-5)
  nextReviewDate: number; // Timestamp
  consecutiveCorrect: number;
  lastErrorDate?: number;
}

export interface LessonStats {
  lessonIndex: number;
  stars: number; // 0-3
  isCompleted: boolean;
}

export interface UserProgress {
  currentLessonIndex: number; // Last active lesson
  completedWordIds: number[]; // Words fully mastered
  wordStats: Record<number, WordStats>; // Map of wordId to stats
  lessonStats: Record<number, LessonStats>; // Track stars per lesson
  lastStudyDate: number;
  totalXp: number; // Gamification
  dayStreak: number;
  reminderEnabled: boolean; // New: Notification setting
  reminderTime: string; // New: "20:00"
}

export enum AppState {
  DASHBOARD,
  COURSES, // New: Course Selection Screen
  SETTINGS, // New: Settings Screen
  SESSION,
  SUMMARY
}

export enum TaskType {
  LEARN = 'LEARN',     // Flip card passive
  CHOICE = 'CHOICE',   // Multiple choice
  ASSEMBLE = 'ASSEMBLE', // Fill in the blank (Cloze)
  SCRAMBLE = 'SCRAMBLE', // New: Reorder full sentence
  MATCH = 'MATCH',       // New: Pair matching game
  SPELL = 'SPELL'      // Type the word
}

export interface Task {
  id: string; // unique string id
  word: Word; // Primary word for the task
  type: TaskType;
  isRetry?: boolean; // If true, this is a penalty card
  groupWords?: Word[]; // New: For MATCH tasks that involve multiple words
}

export const WORDS_PER_LESSON = 6;