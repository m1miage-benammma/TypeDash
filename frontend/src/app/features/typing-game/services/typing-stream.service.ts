import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/responses/api.response';
import { TypingInput } from '../models/typing-input';
import { TypingTest } from '../responses/typing-test.response';

import { TypingBatchRequest, TypingDurationRequest } from '../requests/typing-test.request';

export interface TypingConnection {
  send(inputs: TypingInput[]): boolean;
  setDuration(duration: number): boolean;
  close(): void;
}

const BATCH_INTERVAL_MS = 400;

/** Plain HTTP transport: key batches are POSTed at most every 400 ms; no persistent connection. */
@Injectable({ providedIn: 'root' })
export class TypingStreamService {
  private readonly http = inject(HttpClient);
  connect(id: string, deviceId: string, wordByWord: boolean,
    receive: (test: TypingTest) => void, availability: (ready: boolean) => void,
    initial?: TypingTest): TypingConnection {
    const url = `${environment.apiUrl}/tests/${id}`;
    let closed = false;
    let busy = false;
    let online = true;
    let attempts = 0;
    let acknowledged = initial?.revision ?? -1;
    let snapshot: TypingTest | undefined = initial;
    let desiredDuration: number | undefined;
    let lastSent = 0;
    let needsResync = false;
    let request: Subscription | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    // Keep acknowledged keys until the connection ends so a resync can replay them.
    const history = new Map<number, TypingInput>();

    const schedule = (delay: number) => {
      if (closed || timer !== undefined) return;
      timer = setTimeout(() => { timer = undefined; flush(); }, Math.max(0, delay));
    };
    const armExpiry = () => {
      clearTimeout(expiry);
      if (!snapshot || snapshot.status !== 'running' || snapshot.result) return;
      // The server owns the clock: ask once for the verdict when time should be up.
      expiry = setTimeout(() => { needsResync = true; flush(); }, snapshot.remaining_seconds * 1000 + 300);
    };
    const accept = (response: ApiResponse<TypingTest>) => {
      busy = false;
      attempts = 0;
      needsResync = false;
      if (!response.data || response.data.id !== id) return fail();
      if (!online) { online = true; availability(true); }
      snapshot = snapshot ? {
        ...snapshot, ...response.data,
        view: { ...snapshot.view, ...response.data.view },
      } : response.data;
      acknowledged = Math.max(acknowledged, snapshot.revision);
      if (snapshot.duration === desiredDuration) desiredDuration = undefined;
      for (const sequence of history.keys()) if (sequence <= acknowledged) history.delete(sequence);
      receive(snapshot);
      if (snapshot.result) return close();
      armExpiry();
      if (history.size || desiredDuration !== undefined) schedule(BATCH_INTERVAL_MS - (Date.now() - lastSent));
    };
    const fail = () => {
      busy = false;
      if (closed) return;
      // Any failure resynchronises from the stored state before sending more keys.
      needsResync = true;
      if (online) { online = false; availability(false); }
      schedule(Math.min(500 * 2 ** attempts++, 5000));
    };
    const flush = () => {
      if (closed || busy) return;
      const next = [...history.values()].filter(input => input.sequence > acknowledged)
        .sort((a, b) => a.sequence - b.sequence).slice(0, 32);
      lastSent = Date.now();
      if (needsResync) {
        busy = true;
        request = this.http.get<ApiResponse<TypingTest>>(url, {
          params: { word_by_word: String(wordByWord), compact: 'true' },
        }).subscribe({ next: accept, error: fail });
      } else if (desiredDuration !== undefined) {
        busy = true;
        request = this.http.put<ApiResponse<TypingTest>>(url + '/duration', {
          type: 'duration', device_id: deviceId, duration: desiredDuration,
        } satisfies TypingDurationRequest).subscribe({ next: accept, error: fail });
      } else if (next.length) {
        busy = true;
        request = this.http.post<ApiResponse<TypingTest>>(url + '/inputs', {
          device_id: deviceId, inputs: next.map(input => ({
            key: input.key, sequence: input.sequence, word_by_word: input.wordByWord,
          })),
        } satisfies TypingBatchRequest).subscribe({ next: accept, error: fail });
      }
    };
    const close = () => {
      closed = true;
      clearTimeout(timer);
      clearTimeout(expiry);
      request?.unsubscribe();
    };
    armExpiry();
    return {
      send: inputs => {
        if (closed) return false;
        for (const input of inputs) history.set(input.sequence, input);
        schedule(BATCH_INTERVAL_MS - (Date.now() - lastSent));
        return true;
      },
      setDuration: duration => {
        desiredDuration = duration;
        schedule(0);
        return true;
      },
      close,
    };
  }
}
