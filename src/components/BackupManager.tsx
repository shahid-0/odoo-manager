import React from 'react';
import { Download, Trash2, RotateCcw, Database, Loader2, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBackups } from '../hooks/useBackups';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BackupManagerProps {
  projectId: string;
  onRefresh?: () => void;
}

export function BackupManager({ projectId, onRefresh }: BackupManagerProps) {
  const { 
    backups, 
    loading, 
    actionInProgress, 
    triggerBackup, 
    restoreBackup, 
    deleteBackup,
    downloadBackup 
  } = useBackups(projectId, onRefresh);
  const [restoreConfirmFile, setRestoreConfirmFile] = React.useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const backupOptions = [
    { label: 'Neutralize (No Filestore)', neutralize: true, withFilestore: false },
    { label: 'Neutralize (With Filestore)', neutralize: true, withFilestore: true },
    { label: 'Exact (No Filestore)', neutralize: false, withFilestore: false },
    { label: 'Exact (With Filestore)', neutralize: false, withFilestore: true },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-zinc-200 shadow-sm bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Database className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Odoo Database Manager</CardTitle>
                <CardDescription className="text-xs">Native Odoo backup & restore methods</CardDescription>
              </div>
            </div>
            
            <Select onValueChange={(val: string) => {
              const opt = backupOptions[parseInt(val)];
              triggerBackup({ neutralize: opt.neutralize, withFilestore: opt.withFilestore });
            }} disabled={actionInProgress}>
              <SelectTrigger className="w-[220px] h-9 gap-2">
                {actionInProgress ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <SelectValue placeholder="Create Backup..." />
              </SelectTrigger>
              <SelectContent>
                {backupOptions.map((opt, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
            <p className="text-[10px] text-blue-700 leading-relaxed font-medium">
              <strong>Note:</strong> These operations use Odoo's internal web API. Ensure your <strong>Master Password</strong> is configured in project settings (default is 'admin').
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg border-zinc-200">
              <p className="text-sm text-zinc-500">No Odoo backups found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div 
                  key={backup.filename} 
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-zinc-900 truncate max-w-[180px]" title={backup.filename}>
                      {backup.filename}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[9px] px-1 h-3.5 font-bold ${backup.filename.startsWith('neutralized') ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {backup.filename.startsWith('neutralized') ? 'NEUTRALIZED' : 'EXACT'}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] px-1 h-3.5 border-zinc-200 text-zinc-500">
                        {formatSize(backup.sizeBytes)}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Dialog open={restoreConfirmFile === backup.filepath} onOpenChange={(open) => !open && setRestoreConfirmFile(null)}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" 
                          disabled={actionInProgress}
                          onClick={() => setRestoreConfirmFile(backup.filepath)}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            Restore Database?
                          </DialogTitle>
                          <DialogDescription>
                            This will use Odoo's internal restore process. Your current database will be **OVERWRITTEN**. 
                            If the backup file is a .zip, it will also restore the filestore.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setRestoreConfirmFile(null)}>Cancel</Button>
                          <Button 
                            onClick={() => {
                              restoreBackup(backup.filepath);
                              setRestoreConfirmFile(null);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Restore Now
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-zinc-600 hover:text-zinc-900"
                      onClick={() => downloadBackup(backup.filename)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => deleteBackup(backup.filename)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
