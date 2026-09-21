#!/usr/bin/env node

/**
 * ATRIUM HRIS - Database Migration Script
 * 
 * This script creates all necessary tables and seeds initial data.
 * Run with: node scripts/migrate.js
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'atrium_hris',
  user: process.env.DB_USER || 'atrium_user',
  password: process.env.DB_PASSWORD || '',
};

async function migrate() {
  const pool = new Pool(config);
  
  try {
    console.log('🔄 Running database migration...\n');
    console.log(`📍 Connecting to: ${config.host}:${config.port}/${config.database}\n`);
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to database\n');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    console.log(`📄 Reading schema from: ${schemaPath}\n`);
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    console.log('⚙️  Creating tables and indexes...\n');
    await client.query(schema);
    
    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Tables created:');
    
    // List tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    console.log('\n🎉 Database is ready to use!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start the API server: node server/index.js');
    console.log('   2. Start the frontend: npm run dev');
    console.log('   3. Open http://localhost:5173 in your browser\n');
    
    client.release();
    
  } catch (error) {
    console.error('\n❌ Migration failed!\n');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 PostgreSQL might not be running. Start it with:');
      console.error('   brew services start postgresql@16\n');
    } else if (error.code === '3D000') {
      console.error('\n💡 Database does not exist. Create it with:');
      console.error('   psql postgres');
      console.error('   CREATE DATABASE atrium_hris;');
      console.error('   GRANT ALL PRIVILEGES ON DATABASE atrium_hris TO atrium_user;');
      console.error('   \\q\n');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
