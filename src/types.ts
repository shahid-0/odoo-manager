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
  containerId?: string;
  dbContainerId?: string;
  port?: string;
}

export interface ProjectConfig {
  odooVersion: string;
  dbName: string;
  dbPassword: string;
  dbUser: string;
  odooConf: string;
  addonsPath: string;
  includePostgres: boolean;
  enterpriseAddonsPath: string;
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
  customCompose?: string;
}

export type OdooVersion = '17.0' | '18.0' | '19.0';
