import React, { useState, useEffect } from 'react';
import { Cpu, Database, Network, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useContainerStats } from '../hooks/useContainerStats';
import { motion } from 'motion/react';

interface Props {
  projectId: string;
  type?: 'odoo' | 'db';
  title?: string;
}

export const ContainerStats: React.FC<Props> = ({ projectId, type = 'odoo', title }) => {
  const { stats, error } = useContainerStats(projectId, type as 'odoo' | 'db');
  const [hasReceivedFirstStats, setHasReceivedFirstStats] = useState(false);

  useEffect(() => {
    if (stats) setHasReceivedFirstStats(true);
  }, [stats]);

  if (error) {
    return (
      <div className="text-xs text-red-500 flex items-center gap-2 p-2 bg-red-50 rounded border border-red-100">
        <Activity className="w-3 h-3" />
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-xs text-zinc-400 flex items-center gap-2 p-4 animate-pulse">
        <Activity className="w-3 h-3" />
        Connecting to container stats...
      </div>
    );
  }

  const getGaugeColor = (percent: number) => {
    if (percent < 60) return 'bg-emerald-500';
    if (percent < 85) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-4">
      {title && <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">{title}</h4>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CPU Usage Card */}
        <Card className="border-zinc-200 shadow-none bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-500">CPU Usage</span>
              </div>
              <span className="text-sm font-bold">{hasReceivedFirstStats ? `${stats.cpuUsage}%` : '---'}</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${Math.min(stats.cpuUsage, 100)}%` }}
                 className={`h-full transition-colors duration-500 ${getGaugeColor(stats.cpuUsage)}`}
               />
            </div>
          </CardContent>
        </Card>

        {/* RAM Usage Card */}
        <Card className="border-zinc-200 shadow-none bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-500">Memory</span>
              </div>
              <span className="text-sm font-bold">{stats.memoryUsage} MB <span className="text-[10px] text-zinc-400 font-normal">/ {stats.memoryLimit} MB</span></span>
            </div>
            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${stats.memoryPercent}%` }}
                 className={`h-full transition-colors duration-500 ${getGaugeColor(stats.memoryPercent)}`}
               />
            </div>
          </CardContent>
        </Card>

        {/* Network I/O Card */}
        <Card className="border-zinc-200 shadow-none bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Network className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-500">Network I/O</span>
            </div>
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-400 leading-none">RX</p>
                <p className="text-sm font-bold leading-none">{stats.netIO.rx} MB</p>
              </div>
              <div className="h-6 w-px bg-zinc-100 mx-2" />
              <div className="space-y-1 text-right">
                <p className="text-[10px] text-zinc-400 leading-none">TX</p>
                <p className="text-sm font-bold leading-none">{stats.netIO.tx} MB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
