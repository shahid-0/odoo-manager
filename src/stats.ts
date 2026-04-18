import Docker from 'dockerode';

export interface ContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  netIO: {
    rx: number;
    tx: number;
  };
}

/**
 * Streams container statistics from Dockerode and parses them into a cleaner format.
 */
export function streamContainerStats(
  docker: Docker,
  containerId: string,
  onStats: (stats: ContainerStats) => void,
  onError: (error: Error) => void
) {
  let stream: any;

  const startStreaming = async () => {
    try {
      const container = docker.getContainer(containerId);
      stream = await container.stats({ stream: true });

      stream.on('data', (chunk: Buffer) => {
        try {
          const stats = JSON.parse(chunk.toString());
          
          // CPU Calculation
          // cpu_delta = cpu_total_usage - pre_cpu_total_usage
          // system_delta = system_cpu_usage - pre_system_cpu_usage
          // CPU % = (cpu_delta / system_delta) * online_cpus * 100.0
          const cpuStats = stats.cpu_stats;
          const preCpuStats = stats.precpu_stats;
          
          const cpuDelta = cpuStats.cpu_usage.total_usage - preCpuStats.cpu_usage.total_usage;
          const systemDelta = cpuStats.system_cpu_usage - preCpuStats.system_cpu_usage;
          const onlineCpus = cpuStats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
          
          let cpuPercent = 0.0;
          if (systemDelta > 0 && cpuDelta > 0) {
            cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100.0;
          }

          // Memory Calculation
          // Working set = usage - cache
          const memStats = stats.memory_stats;
          const cache = memStats.stats?.cache || 0;
          const usage = memStats.usage - cache;
          const limit = memStats.limit;
          const memPercent = (usage / limit) * 100.0;

          // Network Calculation
          let rxBytes = 0;
          let txBytes = 0;
          if (stats.networks) {
            Object.values(stats.networks).forEach((net: any) => {
              rxBytes += net.rx_bytes;
              txBytes += net.tx_bytes;
            });
          }

          onStats({
            cpuUsage: Number(cpuPercent.toFixed(1)),
            memoryUsage: Number((usage / 1024 / 1024).toFixed(1)),
            memoryLimit: Number((limit / 1024 / 1024).toFixed(1)),
            memoryPercent: Number(memPercent.toFixed(1)),
            netIO: {
              rx: Number((rxBytes / 1024 / 1024).toFixed(2)),
              tx: Number((txBytes / 1024 / 1024).toFixed(2)),
            }
          });
        } catch (e) {
          // JSON parse errors can happen on stream startup/shutdown
        }
      });

      stream.on('error', (err: Error) => onError(err));
    } catch (err) {
      onError(err as Error);
    }
  };

  startStreaming();

  return () => {
    if (stream) {
      stream.destroy();
    }
  };
}
