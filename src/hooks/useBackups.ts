import { useState, useEffect, useCallback } from 'react';
import { BackupMeta } from '../backup';
import { toast } from 'sonner';

export function useBackups(projectId: string | null, onSuccess?: () => void) {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchBackups = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/backups`);
      if (!res.ok) throw new Error('Failed to fetch backups');
      const data = await res.json();
      setBackups(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const triggerBackup = async (options: { neutralize: boolean; withFilestore: boolean }) => {
    if (!projectId) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/backup`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      if (!res.ok) throw new Error('Backup failed');
      const newBackup = await res.json();
      setBackups(prev => [newBackup, ...prev]);
      toast.success('Backup created successfully');
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const restoreBackup = async (filepath: string) => {
    if (!projectId) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Restore failed');
      }
      toast.success('Database restored successfully');
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const deleteBackup = async (filename: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/backups/${filename}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setBackups(prev => prev.filter(b => b.filename !== filename));
      toast.success('Backup deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const downloadBackup = (filename: string) => {
    if (!projectId) return;
    window.open(`/api/projects/${projectId}/backups/${filename}/download`, '_blank');
  };

  return {
    backups,
    loading,
    error,
    actionInProgress,
    triggerBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    refresh: fetchBackups
  };
}
