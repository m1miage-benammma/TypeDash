import { HttpBackend, HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError, timeout } from 'rxjs';
import { ApiResponse } from '../responses/api.response';
import { SessionIdentity } from '../responses/session-identity.response';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionAuthService {
  private readonly http = new HttpClient(inject(HttpBackend));
  readonly deviceId = signal<string | null>(null);
  private pending?: Observable<string>;

  ensure(): Observable<string> {
    const current = this.deviceId();
    if (current) return of(current);
    return this.pending ??= this.http.post<ApiResponse<SessionIdentity>>(
      environment.apiUrl + '/session', {}, { headers: { 'X-TypeDash-Request': '1' }, withCredentials: true },
    ).pipe(timeout(60000), map(response => response.data.device_id),
      tap(id => this.deviceId.set(id)), finalize(() => this.pending = undefined),
      shareReplay({ bufferSize: 1, refCount: false }));
  }
}

export const sessionAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiUrl + '/')) return next(request);
  const session = inject(SessionAuthService);
  return session.ensure().pipe(switchMap(() => next(request.clone({
    withCredentials: true, setHeaders: { 'X-TypeDash-Request': '1' },
  }))), catchError(error => {
    if (error.status === 401) session.deviceId.set(null);
    return throwError(() => error);
  }));
};
