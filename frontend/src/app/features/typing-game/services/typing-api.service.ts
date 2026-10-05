import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, timeout } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/responses/api.response';
import { PrepareTestRequest } from '../requests/typing-test.request';
import { TypingTest } from '../responses/typing-test.response';

@Injectable({ providedIn: 'root' })
export class TypingApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/tests';

  prepare(options: PrepareTestRequest): Observable<TypingTest> {
    return this.unwrap(this.http.post<ApiResponse<TypingTest>>(this.url, options));
  }

  get(id: string, deviceId: string | null, wordByWord: boolean): Observable<TypingTest> {
    const params: Record<string, string> = { word_by_word: String(wordByWord) };
    if (deviceId) params['device_id'] = deviceId;
    return this.unwrap(this.http.get<ApiResponse<TypingTest>>(this.url + '/' + id, { params }));
  }

  private unwrap(response: Observable<ApiResponse<TypingTest>>): Observable<TypingTest> {
    return response.pipe(timeout(10000), map(value => value.data));
  }

}
