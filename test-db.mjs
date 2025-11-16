// Test script to initialize database
import { initializeDatabase } from './src/db/migrations.ts';

console.log('Testing database initialization...');

try {
  await initializeDatabase();
  console.log('Database initialized successfully!');
} catch (error) {
  console.error('Error initializing database:', error);
}
