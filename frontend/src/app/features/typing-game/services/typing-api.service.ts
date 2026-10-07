import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, map, Observable, of, shareReplay, tap, timeout } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/responses/api.response';
import { PrepareTestRequest } from '../requests/typing-test.request';
import { TypingTest } from '../responses/typing-test.response';

@Injectable({ providedIn: 'root' })
export class TypingApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/tests';
  private readonly byId = new Map<string, TypingTest>();
  private readonly byWordOptions = new Map<string, TypingTest>();
  private readonly pending = new Map<string, Observable<TypingTest>>();
  private active: TypingTest | null = null;

  prepare(options: PrepareTestRequest, forceNew = false): Observable<TypingTest> {
    const key = this.wordKey(options);
    if (!forceNew) {
      const cached = this.byWordOptions.get(key);
      if (cached?.status === 'ready' && !cached.typed && !cached.result) {
        this.active = cached;
        return of(cached);
      }
      const pending = this.pending.get(key);
      if (pending) return pending;
    }
    const request = this.unwrap(this.http.post<ApiResponse<TypingTest>>(
      this.url, { ...options, compact: true },
    )).pipe(
      tap(test => this.remember(test)),
      finalize(() => {
        if (this.pending.get(key) === request) this.pending.delete(key);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    if (!forceNew) this.pending.set(key, request);
    return request;
  }

  get(id: string, deviceId: string | null, wordByWord: boolean): Observable<TypingTest> {
    const cached = this.byId.get(id);
    if (cached) {
      this.active = cached;
      return of(cached);
    }
    const params: Record<string, string> = { word_by_word: String(wordByWord), compact: 'true' };
    if (deviceId) params['device_id'] = deviceId;
    return this.unwrap(this.http.get<ApiResponse<TypingTest>>(this.url + '/' + id, { params })).pipe(
      tap(test => this.remember(test)),
    );
  }

  current(): TypingTest | null {
    return this.active;
  }

  remember(test: TypingTest): void {
    this.active = test;
    if (!this.byId.has(test.id) && this.byId.size >= 32) {
      const oldest = this.byId.keys().next().value as string | undefined;
      if (oldest) this.byId.delete(oldest);
    }
    this.byId.set(test.id, test);
    this.byWordOptions.set(this.wordKey(test), test);
  }

  private unwrap(response: Observable<ApiResponse<TypingTest>>): Observable<TypingTest> {
    return response.pipe(timeout(60000), map(value => value.data));
  }

  private wordKey(options: PrepareTestRequest): string {
    return JSON.stringify([
      options.language ?? 'en', options.difficulty ?? 'easy',
      !!options.punctuation, !!options.numbers,
    ]);
  }

}
