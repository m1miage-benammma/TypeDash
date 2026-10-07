export interface LeaderboardEntry {
  rank: number;
  username: string;
  wpm: number;
}

export interface Leaderboards {
  average: LeaderboardEntry[];
  top_speed: LeaderboardEntry[];
}
