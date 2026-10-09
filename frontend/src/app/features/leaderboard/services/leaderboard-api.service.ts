import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, shareReplay, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/responses/api.response';
import { Leaderboards } from '../responses/leaderboard.response';

@Injectable({ providedIn: 'root' })
export class LeaderboardApiService {
  private readonly http = inject(HttpClient);
  private cacheKey = '';
  private cached?: Observable<Leaderboards>;

  get(cacheKey: string): Observable<Leaderboards> {
    if (this.cached && this.cacheKey === cacheKey) return this.cached;
    this.cacheKey = cacheKey;
    this.cached = this.http.get<ApiResponse<Leaderboards>>(environment.apiUrl + '/leaderboard').pipe(
      timeout(15000), map(response => response.data),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cached;
  }
}
