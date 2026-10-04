export interface DeviceSummary {
  sessions: number;
  best_wpm: number;
  average_wpm: number;
  average_accuracy: number;
}

export interface DeviceStat {
  id: string;
  test_id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: 'en' | 'fr';
  duration: number;
  punctuation: boolean;
  numbers: boolean;
  wpm: number;
  accuracy: number;
  correct_characters: number;
  incorrect_characters: number;
  typed_characters: number;
  completed_words: number;
  elapsed_seconds: number;
  finished_at: string;
}

export interface DeviceProfile {
  device_id: string;
  username: string | null;
  registered: boolean;
  username_changes: number;
  username_changes_remaining: number;
  summary: DeviceSummary;
  stats: DeviceStat[];
}
