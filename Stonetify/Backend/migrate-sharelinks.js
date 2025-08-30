const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_DATABASE || 'stonetify_db',
  process.env.DB_USER || 'test',
  process.env.DB_PASSWORD || '1111',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: console.log
  }
);

async function migrateShareLinks() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established');

    // ShareLink 테이블 존재 확인
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'share_links'");
    
    if (tables.length === 0) {
      console.log('Creating share_links table...');
      await sequelize.query(`
        CREATE TABLE share_links (
          id INT AUTO_INCREMENT PRIMARY KEY,
          playlist_id INT NOT NULL,
          share_id VARCHAR(255) UNIQUE,
          share_url VARCHAR(500) NOT NULL,
          qr_code_url VARCHAR(500),
          created_by INT,
          view_count INT DEFAULT 0,
          share_count INT DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    } else {
      console.log('Adding missing columns to share_links table...');
      
      // 컬럼들을 하나씩 추가
      const columnsToAdd = [
        'ADD COLUMN share_id VARCHAR(255) UNIQUE',
        'ADD COLUMN created_by INT',
        'ADD COLUMN view_count INT DEFAULT 0',
        'ADD COLUMN share_count INT DEFAULT 0',
        'ADD COLUMN is_active BOOLEAN DEFAULT TRUE'
      ];

      for (const column of columnsToAdd) {
        try {
          await sequelize.query(`ALTER TABLE share_links ${column}`);
          console.log(`Added column: ${column}`);
        } catch (error) {
          console.log(`Column might already exist: ${column}`);
        }
      }

      // updated_at 컬럼 수정
      try {
        await sequelize.query(`
          ALTER TABLE share_links 
          MODIFY COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `);
        console.log('Updated updated_at column');
      } catch (error) {
        console.log('updated_at column modification failed:', error.message);
      }
    }

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateShareLinks();
