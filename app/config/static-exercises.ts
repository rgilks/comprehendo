// Define and EXPORT the type for the static exercises
export interface GeneratedContentRow {
  id: number;
  language: string;
  level: string;
  content: string;
  questions: string;
  created_at: string;
}

// Define and export 3 static A1 exercises for unlogged-in users
export const staticA1Exercises: GeneratedContentRow[] = [
  // ... existing data ...
];
