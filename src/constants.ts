import { OdooVersion } from './types';

export const ODOO_VERSIONS: OdooVersion[] = ['17.0', '18.0', '19.0'];

function generatePassword(length = 16): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return Array.from(array)
    .map((x) => chars[x % chars.length])
    .join("");
}

const adminPassword = generatePassword();

const DEFAULT_ODOO_CONF = `[options]
addons_path = /mnt/extra-addons
data_dir = /var/lib/odoo
db_host = db
db_port = 5432
db_user = odoo
db_password = odoo
admin_passwd = ${adminPassword}
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
