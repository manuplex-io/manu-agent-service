import { DataSource } from 'typeorm';

const isLocalEnv = ['local', 'localhost'].includes(process.env.ENV);
const isDevEnv = process.env.ENV === 'dev';
const isProdEnv = process.env.ENV === 'prod';

// Add these exports before the @Global() decorator
const MigrationDataSource = new DataSource({
  type: 'postgres',
  host: process.env.OB1_VECTOR_DB_HOST,
  port: +process.env.OB1_DB_PORT,
  database: process.env.OB1_DB_DATABASE_AGENTSERVICE || 'ob1-agentServices-db',
  username: isLocalEnv
    ? process.env.OB1_DB_USERNAME_AGENTSERVICE_LOCAL
    : isDevEnv
      ? process.env.OB1_DB_USERNAME_AGENTSERVICE_DEV
      : process.env.OB1_DB_USERNAME_AGENTSERVICE,
  password: isLocalEnv
    ? process.env.OB1_DB_PASSWORD_AGENTSERVICE_LOCAL
    : isDevEnv
      ? process.env.OB1_DB_PASSWORD_AGENTSERVICE_DEV
      : process.env.OB1_DB_PASSWORD_AGENTSERVICE,
synchronize: false,
  entities: [],
  migrations: [__dirname + '/vector/pre-cleanup/*.{ts,js}'],
});

export default MigrationDataSource;
