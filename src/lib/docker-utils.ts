import yaml from 'js-yaml';
import { ProjectConfig } from '../types';

export function generateDockerCompose(projectName: string, config: ProjectConfig): string {
  const services: any = {
    web: {
      image: `odoo:${config.odooVersion}`,
      depends_on: config.includePostgres ? ['db'] : [],
      ports: ['8069:8069'],
      volumes: [
        'odoo-data:/var/lib/odoo',
        './config:/etc/odoo',
        `${config.addonsPath}:/mnt/extra-addons`,
      ],
      environment: [
        `HOST=db`,
        `USER=odoo`,
        `PASSWORD=${config.dbPassword}`,
      ],
      networks: ['odoo-network'],
      deploy: {
        replicas: config.replicas,
        resources: {
          limits: {
            cpus: config.resourceLimits.cpu,
            memory: config.resourceLimits.memory,
          },
        },
      },
      logging: {
        driver: config.loggingConfig.driver,
        options: {
          'max-size': config.loggingConfig.maxSize,
          'max-file': config.loggingConfig.maxFile,
        },
      },
      healthcheck: {
        test: ['CMD', 'curl', '-f', 'http://localhost:8069/web/health'],
        interval: config.healthCheck.interval,
        timeout: config.healthCheck.timeout,
        retries: config.healthCheck.retries,
      },
    },
  };

  if (config.includePostgres) {
    services.db = {
      image: 'postgres:15',
      environment: [
        `POSTGRES_DB=postgres`,
        `POSTGRES_PASSWORD=${config.dbPassword}`,
        `POSTGRES_USER=odoo`,
        `PGDATA=/var/lib/postgresql/data/pgdata`,
      ],
      volumes: ['db-data:/var/lib/postgresql/data/pgdata'],
      networks: ['odoo-network'],
      healthcheck: {
        test: ['CMD-SHELL', 'pg_isready -U odoo'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
    };
  }

  const compose = {
    version: '3.8',
    services,
    networks: {
      'odoo-network': {
        driver: 'bridge',
      },
    },
    volumes: {
      'odoo-data': {},
      'db-data': {},
    },
  };

  return yaml.dump(compose);
}
