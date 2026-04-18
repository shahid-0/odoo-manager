import yaml from 'js-yaml';
import { ProjectConfig } from '../types';

export function generateDockerCompose(projectName: string, config: ProjectConfig, projectId?: string): string {
  const safeName = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const idSuffix = projectId ? `-${projectId.slice(0, 8)}` : '';
  const webVolume = `${safeName}-web-data${idSuffix}`;
  const dbVolume = `${safeName}-db-data${idSuffix}`;

  const services: any = {
    web: {
      image: `odoo:${config.odooVersion}`,
      depends_on: config.includePostgres ? ['db'] : [],
      ports: [`${config.hostPort || 8069}:8069`],
      volumes: [
        `${webVolume}:/var/lib/odoo`,
        './config:/etc/odoo',
      ],
      environment: [
        `HOST=db`,
        `USER=${config.dbUser}`,
        `PASSWORD=${config.dbPassword}`,
      ],
      restart: 'always',

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

  const addonsPaths = config.addonsPaths || [];
  addonsPaths.forEach((path, i) => {
    if (path.trim()) {
      services.web.volumes.push(`${path.trim()}:/mnt/extra-addons-${i}`);
    }
  });
  if (config.includePostgres) {
    services.db = {
      image: 'postgres:15',
      environment: [
        `POSTGRES_DB=${config.dbName}`,
        `POSTGRES_PASSWORD=${config.dbPassword}`,
        `POSTGRES_USER=${config.dbUser}`,
        `PGDATA=/var/lib/postgresql/data/pgdata`,
      ],
      volumes: [`${dbVolume}:/var/lib/postgresql/data/pgdata`],
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
      [webVolume]: {},
      [dbVolume]: {},
    },
  };

  return yaml.dump(compose, { lineWidth: -1 });
}
