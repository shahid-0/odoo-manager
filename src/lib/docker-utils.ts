import yaml from 'js-yaml';
import { ProjectConfig } from '../types';

export function generateDockerCompose(projectName: string, config: ProjectConfig): string {
  const safeName = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const services: any = {
    web: {
      image: `odoo:${config.odooVersion}`,
      depends_on: config.includePostgres ? ['db'] : [],
      ports: ['8069:8069'],
      volumes: [
        'odoo-web-data:/var/lib/odoo',
        './config:/etc/odoo',
        `${config.addonsPath}:/mnt/extra-addons`,
      ],
      environment: [
        `HOST=db`,
        `USER=${config.dbUser}`,
        `PASSWORD=${config.dbPassword}`,
      ],
      restart: 'always',
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

  // Add enterprise addons volume if specified
  if (config.enterpriseAddonsPath && config.enterpriseAddonsPath.trim()) {
    services.web.volumes.push(`${config.enterpriseAddonsPath}:/mnt/enterprise-addons`);
  }

  if (config.includePostgres) {
    services.db = {
      image: 'postgres:15',
      environment: [
        `POSTGRES_DB=${config.dbName}`,
        `POSTGRES_PASSWORD=${config.dbPassword}`,
        `POSTGRES_USER=${config.dbUser}`,
        `PGDATA=/var/lib/postgresql/data/pgdata`,
      ],
      volumes: ['odoo-db-data:/var/lib/postgresql/data/pgdata'],
      restart: 'always',
      healthcheck: {
        test: ['CMD-SHELL', `pg_isready -U ${config.dbUser}`],
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
    };
  }

  const compose: any = {
    services,
    volumes: {
      'odoo-web-data': {},
      'odoo-db-data': {},
    },
  };

  return yaml.dump(compose, { lineWidth: -1 });
}
