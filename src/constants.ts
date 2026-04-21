import { OdooVersion } from './types';

export const ODOO_VERSIONS: OdooVersion[] = ['17.0', '18.0', '19.0'];

const DEFAULT_ODOO_CONF = `[options]
addons_path = /mnt/extra-addons
data_dir = /var/lib/odoo
db_host = db
db_port = 5432
db_user = odoo
db_password = odoo
`;

export const DEFAULT_PROJECT_CONFIG = {
  odooVersion: '19.0' as OdooVersion,
  hostPort: 8069,
  dbName: 'postgres',
  dbPassword: 'odoo',
  dbUser: 'odoo',
  odooConf: DEFAULT_ODOO_CONF,
  addonsPaths: ['./addons'],
  includePostgres: true,
  loggingConfig: {
    driver: 'json-file',
    maxSize: '10m',
    maxFile: '3',
  },
  healthCheck: {
    interval: '30s',
    timeout: '10s',
    retries: 3,
  },
};
