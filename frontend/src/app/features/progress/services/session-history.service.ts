import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DeviceIdentityService } from '../../../core/services/device-identity.service';
import { ApiResponse } from '../../../core/responses/api.response';
import { SessionResultResponse } from '../../typing-game/responses/session-result.response';

@Injectable({ providedIn: 'root' })
export class SessionHistoryService {
  private readonly http = inject(HttpClient);
  private readonly identity = inject(DeviceIdentityService);

  get(statId: string) {
    const deviceId = this.identity.deviceId();
    if (!deviceId) return throwError(() => new Error('Device identifier is unavailable.'));
    return this.http.get<ApiResponse<SessionResultResponse>>(
      `${environment.apiUrl}/devices/${deviceId}/stats/${statId}`,
    ).pipe(timeout(15000), map(response => response.data));
  }
}
