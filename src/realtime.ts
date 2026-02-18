import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { uid } from './utils/uid';
import type { Situation, Scenario } from './types';

type SharedData = { situations: Situation[]; scenarios: Scenario[] };
type SyncStatus = 'connecting' | 'online' | 'offline';

type SyncStateMessage = {
  version: number;
  updatedAt: string;
  data: SharedData;
  clientId?: string;
};

function sharedDataFromStore(): SharedData {
  const state = useStore.getState();
  return {
    situations: state.situations,
    scenarios: state.scenarios,
  };
}

function hasMeaningfulData(data: SharedData): boolean {
  return data.situations.length > 0 || data.scenarios.length > 0;
}

export function useRealtimeSync(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const clientIdRef = useRef(uid());
  const latestVersionRef = useRef(0);
  const applyingRemoteRef = useRef(false);
  const sendTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isClosed = false;
    let eventSource: EventSource | null = null;

    const pushState = async (data: SharedData) => {
      try {
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: clientIdRef.current,
            baseVersion: latestVersionRef.current,
            data,
          }),
        });

        if (!response.ok) return;
        const payload = (await response.json()) as { version?: number };
        if (typeof payload.version === 'number') {
          latestVersionRef.current = Math.max(latestVersionRef.current, payload.version);
        }
      } catch {
        setStatus('offline');
      }
    };

    const schedulePush = (data: SharedData) => {
      if (sendTimerRef.current !== null) window.clearTimeout(sendTimerRef.current);
      sendTimerRef.current = window.setTimeout(() => {
        void pushState(data);
      }, 200);
    };

    const applyRemoteState = (payload: SyncStateMessage) => {
      if (!payload || !payload.data) return;
      if (payload.clientId && payload.clientId === clientIdRef.current) {
        latestVersionRef.current = Math.max(latestVersionRef.current, payload.version || 0);
        return;
      }
      if ((payload.version || 0) <= latestVersionRef.current) return;

      latestVersionRef.current = payload.version || latestVersionRef.current;
      applyingRemoteRef.current = true;
      useStore.getState().replaceData(payload.data);
      applyingRemoteRef.current = false;
    };

    const connectEvents = () => {
      if (isClosed) return;
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => setStatus('online');

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as SyncStateMessage;
          applyRemoteState(payload);
        } catch {
          // ignore malformed event payloads
        }
      };

      eventSource.onerror = () => {
        setStatus('offline');
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          window.setTimeout(connectEvents, 2000);
        }
      };
    };

    const bootstrap = async () => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('sync_state_request_failed');
        const remote = (await response.json()) as SyncStateMessage;

        const local = sharedDataFromStore();
        const remoteData = remote?.data;

        if (remoteData && hasMeaningfulData(remoteData)) {
          applyRemoteState(remote);
        } else if (hasMeaningfulData(local)) {
          await pushState(local);
        }

        setStatus('online');
      } catch {
        setStatus('offline');
      }

      connectEvents();
    };

    const unsubscribe = useStore.subscribe((state, prev) => {
      if (applyingRemoteRef.current) return;
      if (state.situations === prev.situations && state.scenarios === prev.scenarios) return;
      schedulePush({ situations: state.situations, scenarios: state.scenarios });
    });

    void bootstrap();

    return () => {
      isClosed = true;
      if (sendTimerRef.current !== null) {
        window.clearTimeout(sendTimerRef.current);
      }
      unsubscribe();
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return status;
}
