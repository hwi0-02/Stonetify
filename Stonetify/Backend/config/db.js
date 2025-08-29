// C:\Stonetify\Stonetify\Backend\config\db.js

module.exports = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'stonetify_db',
  dialect: 'mysql',
};