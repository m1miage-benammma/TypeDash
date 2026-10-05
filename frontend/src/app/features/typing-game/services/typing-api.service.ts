import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, timeout } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { PrepareTestRequest, TypingTest, TypingInput } from '../models/typing-test';

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

  input(id: string, deviceId: string, key: string, sequence: number, wordByWord: boolean): Observable<TypingTest> {
    return this.unwrap(this.http.put<ApiResponse<TypingTest>>(this.url + '/' + id + '/input', {
      device_id: deviceId, key, sequence, word_by_word: wordByWord,
    }));
  }

  private unwrap(response: Observable<ApiResponse<TypingTest>>): Observable<TypingTest> {
    return response.pipe(timeout(10000), map(value => value.data));
  }

  inputs(id: string, deviceId: string, inputs: TypingInput[]): Observable<TypingTest> {
    return this.unwrap(this.http.put<ApiResponse<TypingTest>>(this.url + '/' + id + '/inputs', {
      device_id: deviceId,
      inputs: inputs.map(input => ({
        key: input.key, sequence: input.sequence, word_by_word: input.wordByWord,
      })),
    }));
  }
}
