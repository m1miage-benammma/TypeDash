import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap, throwError, timeout } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../responses/api.response';
import { DeviceProfile } from '../responses/device-profile.response';

import { UsernameRequest } from '../requests/username.request';

const DEVICE_ID_KEY = 'typedash.device-id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class DeviceIdentityService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/devices';
  private readonly profileState = signal<DeviceProfile | null>(null);
  private volatileDeviceId: string | null = null;

  readonly profile = this.profileState.asReadonly();
  readonly loading = signal(false);

  constructor() {
    if (this.deviceId()) {
      this.loadProfile().subscribe({ error: () => undefined });
    }
  }

  deviceId(): string | null {
    if (this.volatileDeviceId) return this.volatileDeviceId;
    try {
      const stored = localStorage.getItem(DEVICE_ID_KEY);
      return stored && UUID_PATTERN.test(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  ensureDeviceId(): string {
    const current = this.deviceId();
    if (current) return current;
    const created = crypto.randomUUID();
    this.volatileDeviceId = created;
    try { localStorage.setItem(DEVICE_ID_KEY, created); } catch { /* Keep it for this tab session. */ }
    return created;
  }

  loadProfile(): Observable<DeviceProfile | null> {
    const deviceId = this.deviceId();
    if (!deviceId) {
      this.profileState.set(null);
      return of(null);
    }
    this.loading.set(true);
    return this.unwrap(this.http.get<ApiResponse<DeviceProfile>>(`${this.url}/${deviceId}`)).pipe(
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
