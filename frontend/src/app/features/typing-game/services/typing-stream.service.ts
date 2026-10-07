import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { StreamTicket } from '../../../core/responses/session-identity.response';
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

@Injectable({ providedIn: 'root' })
export class TypingStreamService {
  private readonly http = inject(HttpClient);
  connect(id: string, deviceId: string, wordByWord: boolean,
    receive: (test: TypingTest) => void, availability: (ready: boolean) => void,
    initial?: TypingTest): TypingConnection {
    const url = new URL(`/api/tests/${id}/stream`, environment.streamOrigin || location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('word_by_word', String(wordByWord));
    if (initial) url.searchParams.set('compact', 'true');
    let socket: WebSocket;
    let closed = false;
    let ready = false;
    let attempts = 0;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let snapshot: TypingTest | undefined = initial;
    let authentication: Subscription | undefined;
    let replayTimer: ReturnType<typeof setTimeout> | undefined;
    let sentRevision = -1;
    let allowance = 32;
    let desiredDuration: number | undefined;
    // Retain acknowledged keys too, until this connection ends: a server restart
    // can recover from the last database checkpoint without losing recent input.
    const history = new Map<number, TypingInput>();
    const sendFrame = (inputs: TypingInput[]) => socket.send(JSON.stringify({
      device_id: deviceId, inputs: inputs.map(input => ({
        key: input.key, sequence: input.sequence, word_by_word: input.wordByWord,
      })),
    } satisfies TypingBatchRequest));
    const sendDuration = () => {
      if (!ready || desiredDuration === undefined || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({
        type: 'duration', device_id: deviceId, duration: desiredDuration,
      } satisfies TypingDurationRequest));
      return true;
    };
    const pump = () => {
      if (!ready || closed || socket.readyState !== WebSocket.OPEN) return;
      const next = [...history.values()].filter(input => input.sequence > sentRevision)
        .sort((a, b) => a.sequence - b.sequence).slice(0, allowance);
      if (!next.length) return;
      sendFrame(next);
      sentRevision = next[next.length - 1].sequence;
      allowance -= next.length;
      replayTimer ??= setTimeout(() => {
        replayTimer = undefined;
        allowance = 32;
        pump();
      }, 1100);
    };
    const armWatchdog = (current: WebSocket, timeout = 10000) => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (!closed && socket === current) current.close();
      }, timeout);
    };
    const open = () => {
      if (closed) return;
      ready = false;
      authentication = this.http.post<ApiResponse<StreamTicket>>(
        `${environment.apiUrl}/tests/${id}/ticket`, {},
      ).subscribe({ next: response => openSocket(response.data.ticket), error: () => {
        if (closed) return;
        availability(false);
        reconnect = setTimeout(open, Math.min(1000 * 2 ** attempts++, 10000));
      } });
    };
    const openSocket = (ticket: string) => {
      if (closed) return;
      socket = new WebSocket(url);
      const current = socket;
      current.onopen = () => current.send(JSON.stringify({ ticket }));
      // A first handshake/database load can take longer than a heartbeat.
      // Connecting is not an interruption: report failure only on a real close.
      armWatchdog(current, 60000);
      current.onmessage = event => {
        if (closed || socket !== current) return;
        try {
          const response = JSON.parse(event.data) as ApiResponse<TypingTest>;
          if (!response.data || response.data.id !== id) { socket.close(); return; }
          armWatchdog(current);
          if (!ready) {
            clearTimeout(replayTimer);
            replayTimer = undefined;
            allowance = 32;
            sentRevision = response.data.revision;
            ready = true;
            sendDuration();
            pump();
            attempts = 0;
            availability(true);
          }
          snapshot = snapshot ? {
            ...snapshot, ...response.data,
            view: { ...snapshot.view, ...response.data.view },
          } : response.data;
          if (response.data.duration === desiredDuration) desiredDuration = undefined;
          receive(snapshot);
          if (response.data.result) close();
        } catch { socket.close(); }
      };
      current.onerror = () => current.close();
      current.onclose = () => {
        if (closed || socket !== current) return;
        clearTimeout(watchdog);
        ready = false;
        availability(false);
        reconnect = setTimeout(open, Math.min(500 * 2 ** attempts++, 5000));
      };
    };
    const close = () => {
      closed = true;
      ready = false;
      clearTimeout(reconnect);
      clearTimeout(watchdog);
      clearTimeout(replayTimer);
      authentication?.unsubscribe();
      socket?.close();
    };
    open();
    return {
      send: inputs => {
        if (!ready || socket.readyState !== WebSocket.OPEN) return false;
        for (const input of inputs) history.set(input.sequence, input);
        pump();
        return true;
      },
      setDuration: duration => {
        desiredDuration = duration;
        return sendDuration();
      },
      close,
    };
  }
}
