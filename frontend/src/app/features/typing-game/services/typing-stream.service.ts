import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/responses/api.response';
import { TypingInput } from '../models/typing-input';
import { TypingTest } from '../responses/typing-test.response';

import { TypingBatchRequest } from '../requests/typing-test.request';

export interface TypingConnection {
  send(inputs: TypingInput[]): boolean;
  close(): void;
}

@Injectable({ providedIn: 'root' })
export class TypingStreamService {
  connect(id: string, deviceId: string, wordByWord: boolean,
    receive: (test: TypingTest) => void, availability: (ready: boolean) => void): TypingConnection {
    const url = new URL(`/api/tests/${id}/stream`, environment.streamOrigin || location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('device_id', deviceId);
    url.searchParams.set('word_by_word', String(wordByWord));
    let socket: WebSocket;
    let closed = false;
    let ready = false;
    let attempts = 0;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let snapshot: TypingTest | undefined;
    // Retain acknowledged keys too, until this connection ends: a server restart
    // can recover from the last database checkpoint without losing recent input.
    const history = new Map<number, TypingInput>();
    const sendFrame = (inputs: TypingInput[]) => socket.send(JSON.stringify({
      device_id: deviceId, inputs: inputs.map(input => ({
        key: input.key, sequence: input.sequence, word_by_word: input.wordByWord,
      })),
    } satisfies TypingBatchRequest));
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => socket.close(), 10000);
    };
    const open = () => {
      if (closed) return;
      ready = false;
      availability(false);
      socket = new WebSocket(url);
      armWatchdog();
      socket.onmessage = event => {
        try {
          const response = JSON.parse(event.data) as ApiResponse<TypingTest>;
          if (!response.data || response.data.id !== id) { socket.close(); return; }
          armWatchdog();
          if (!ready) {
            const replay = [...history.values()].filter(input => input.sequence > response.data.revision);
            for (let offset = 0; offset < replay.length; offset += 256) sendFrame(replay.slice(offset, offset + 256));
            ready = true;
            attempts = 0;
            availability(true);
          }
          snapshot = snapshot ? {
            ...snapshot, ...response.data,
            view: { ...snapshot.view, ...response.data.view },
          } : response.data;
          receive(snapshot);
          if (response.data.result) close();
        } catch { socket.close(); }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        clearTimeout(watchdog);
        ready = false;
        if (closed) return;
        availability(false);
        reconnect = setTimeout(open, Math.min(500 * 2 ** attempts++, 5000));
      };
    };
    const close = () => {
      closed = true;
      ready = false;
      clearTimeout(reconnect);
      clearTimeout(watchdog);
      socket?.close();
    };
    open();
    return {
      send: inputs => {
        if (!ready || socket.readyState !== WebSocket.OPEN) return false;
        for (const input of inputs) history.set(input.sequence, input);
        sendFrame(inputs);
        return true;
      },
      close,
    };
  }
}
