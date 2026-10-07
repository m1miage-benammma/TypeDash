import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, switchMap, tap, throwError, timeout } from 'rxjs';
import { SessionAuthService } from './session-auth.service';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../responses/api.response';
import { DeviceProfile } from '../responses/device-profile.response';

import { UsernameRequest } from '../requests/username.request';

@Injectable({ providedIn: 'root' })
export class DeviceIdentityService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/devices';
  private readonly profileState = signal<DeviceProfile | null>(null);
  private readonly session = inject(SessionAuthService);

  readonly profile = this.profileState.asReadonly();
  readonly loading = signal(false);

  constructor() {
    afterNextRender(() => {
      this.loadProfile().subscribe({ error: () => undefined });
    });
  }

  deviceId(): string | null {
    return this.session.deviceId();
  }

  ensureDeviceId(): string {
    const current = this.deviceId();
    if (!current) throw new Error('Session authentication is not ready.');
    return current;
  }

  loadProfile(): Observable<DeviceProfile | null> {
    this.loading.set(true);
    return this.session.ensure().pipe(switchMap(deviceId =>
      this.unwrap(this.http.get<ApiResponse<DeviceProfile>>(`${this.url}/${deviceId}`))),
      tap(profile => this.profileState.set(profile)),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.profileState.set(null);
          return of(null);
        }
        return throwError(() => error);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  register(username: string): Observable<DeviceProfile> {
    const deviceId = this.ensureDeviceId();
    return this.unwrap(this.http.put<ApiResponse<DeviceProfile>>(
      `${this.url}/${deviceId}/registration`,
      { username } satisfies UsernameRequest,
    )).pipe(tap(profile => this.profileState.set(profile)));
  }

  updateUsername(username: string): Observable<DeviceProfile> {
    const deviceId = this.deviceId();
    if (!deviceId) return throwError(() => new Error('Device identifier is unavailable.'));
    return this.unwrap(this.http.patch<ApiResponse<DeviceProfile>>(
      `${this.url}/${deviceId}/username`,
      { username } satisfies UsernameRequest,
    )).pipe(tap(profile => this.profileState.set(profile)));
  }

  clearStats(): Observable<DeviceProfile> {
    const deviceId = this.deviceId();
    if (!deviceId) return throwError(() => new Error('Device identifier is unavailable.'));
    return this.unwrap(this.http.delete<ApiResponse<DeviceProfile>>(
      `${this.url}/${deviceId}/stats`,
    )).pipe(tap(profile => this.profileState.set(profile)));
  }

  private unwrap(source: Observable<ApiResponse<DeviceProfile>>): Observable<DeviceProfile> {
    return source.pipe(timeout(10000), map(response => response.data));
  }
}
