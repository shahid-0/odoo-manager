import { useState, useEffect } from 'react';
import { ContainerStats } from '../stats';

/**
 * Custom hook to stream container statistics via Server-Sent Events.
 */
export function useContainerStats(projectId: string | null, type: 'odoo' | 'db' = 'odoo') {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setStats(null);
      return;
    }

    const eventSource = new EventSource(`/api/projects/${projectId}/stats/stream?type=${type}`);

    eventSource.onmessage = (event) => {
      try {
        const data: ContainerStats = JSON.parse(event.data);
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Failed to parse stats data', err);
      }
    };

    eventSource.addEventListener('error', (event: any) => {
      if (event.data) {
        const errData = JSON.parse(event.data);
        setError(errData.message || 'Unknown stream error');
      } else if (eventSource.readyState === EventSource.CLOSED) {
        // Normal cleanup or server error
      } else {
        setError('Connection to stats stream lost');
      }
    });

    return () => {
      eventSource.close();
    };
  }, [projectId, type]);

  return { stats, error };
}
