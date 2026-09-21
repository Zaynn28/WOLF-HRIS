#!/usr/bin/env node

/**
 * ATRIUM HRIS - Database Connection Test
 * 
 * This script tests the database connection.
 * Run with: node scripts/test-db.js
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'atrium_hris',
  user: process.env.DB_USER || 'atrium_user',
  password: process.env.DB_PASSWORD || '',
};

async function testConnection() {
  const pool = new Pool(config);
  
  console.log('🔍 Testing database connection...\n');
  console.log(`📍 Host: ${config.host}`);
  console.log(`📍 Port: ${config.port}`);
  console.log(`📍 Database: ${config.database}`);
  console.log(`📍 User: ${config.user}\n`);
  
  try {
    const start = Date.now();
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    const duration = Date.now() - start;
    
    console.log('✅ Connection successful!\n');
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`🕐 Server time: ${result.rows[0].current_time}`);
    console.log(`📦 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}\n`);
    
    // Check tables
    const tables = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`📊 Tables in database: ${tables.rows[0].table_count}\n`);
    
    if (parseInt(tables.rows[0].table_count) === 0) {
      console.log('⚠️  No tables found. Run migration first:');
      console.log('   node scripts/migrate.js\n');
    } else {
      console.log('✅ Database is ready!\n');
    }
    
    client.release();
    
  } catch (error) {
    console.error('\n❌ Connection failed!\n');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 PostgreSQL is not running. Start it with:');
      console.error('   brew services start postgresql@16\n');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed. Check your credentials in .env file\n');
    } else if (error.code === '3D000') {
      console.error('\n💡 Database does not exist. Create it first:\n');
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

testConnection();
