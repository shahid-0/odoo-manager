export interface Organization {
  id: string;
  name: string;
  projects: Project[];
  createdAt: string;
}

export type ProjectStatus = 'idle' | 'deploying' | 'running' | 'error' | 'stopped';

export interface Project {
  id: string;
  name: string;
  description: string;
  config: ProjectConfig;
  createdAt: string;
  status?: ProjectStatus;
  logs?: string[];
}

export interface ProjectConfig {
  odooVersion: string;
  dbName: string;
  dbPassword: string;
  odooConf: string;
  addonsPath: string;
  includePostgres: boolean;
  resourceLimits: {
    memory: string;
    cpu: string;
  };
  loggingConfig: {
    driver: string;
    maxSize: string;
    maxFile: string;
  };
  healthCheck: {
    interval: string;
    timeout: string;
    retries: number;
  };
  replicas: number;
}

export type OdooVersion = '14.0' | '15.0' | '16.0' | '17.0' | '18.0';
