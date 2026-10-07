import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/responses/api.response';
import { Leaderboards } from '../responses/leaderboard.response';

@Injectable({ providedIn: 'root' })
export class LeaderboardApiService {
  private readonly http = inject(HttpClient);

  get() {
    return this.http.get<ApiResponse<Leaderboards>>(environment.apiUrl + '/leaderboard').pipe(
      timeout(15000), map(response => response.data),
    );
  }
}
