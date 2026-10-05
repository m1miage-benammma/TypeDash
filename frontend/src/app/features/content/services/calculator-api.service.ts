import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, timeout } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response';
import { CalculatorRequest, CalculatorResult } from '../models/calculator';

@Injectable({ providedIn: 'root' })
export class CalculatorApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + '/calculator';

  defaults(): Observable<CalculatorResult> {
    return this.unwrap(this.http.get<ApiResponse<CalculatorResult>>(this.url));
  }

  calculate(request: CalculatorRequest): Observable<CalculatorResult> {
    return this.unwrap(this.http.post<ApiResponse<CalculatorResult>>(this.url, request));
  }

  private unwrap(source: Observable<ApiResponse<CalculatorResult>>): Observable<CalculatorResult> {
    return source.pipe(timeout(10000), map(response => response.data));
  }
}
