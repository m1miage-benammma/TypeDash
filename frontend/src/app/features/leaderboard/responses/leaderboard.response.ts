export interface LeaderboardEntry {
  rank: number;
  username: string;
  wpm: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  is_current: boolean;
}

export interface Leaderboards {
  average: LeaderboardEntry[];
  top_speed: LeaderboardEntry[];
}
