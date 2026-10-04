import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, TestOptions, TypingTest } from '../models/typing-test';

@Injectable({ providedIn: 'root' })
export class TypingApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/tests';

  prepare(options: TestOptions): Observable<TypingTest> {
    return this.unwrap(this.http.post<ApiResponse<TypingTest>>(this.url, options));
  }
  get(id: string): Observable<TypingTest> {
    return this.unwrap(this.http.get<ApiResponse<TypingTest>>(this.url + '/' + id));
  }
  progress(id: string, typed: string, revision: number): Observable<TypingTest> {
    return this.unwrap(this.http.put<ApiResponse<TypingTest>>(this.url + '/' + id + '/progress', { typed, revision }));
  }
  finish(id: string, typed: string, revision: number): Observable<TypingTest> {
    return this.unwrap(this.http.post<ApiResponse<TypingTest>>(this.url + '/' + id + '/finish', { typed, revision }));
  }
  private unwrap(source: Observable<ApiResponse<TypingTest>>): Observable<TypingTest> {
    return source.pipe(timeout(10000), map(response => response.data));
  }
}
