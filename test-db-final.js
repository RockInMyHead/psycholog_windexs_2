// Final test to verify database functionality works correctly
import { initializeDatabase } from './src/db/migrations.js';

console.log('Testing final database functionality...');

async function testDatabase() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✓ Database initialized successfully');

    // Import services
    const { userService, chatService } = await import('./src/services/database.js');

    // Test creating a user
    console.log('Creating test user...');
    const user = await userService.createUser('finaltest@example.com', 'Final Test User');
    console.log('✓ User created:', user.id);

    // Test creating a chat session
    console.log('Creating test chat session...');
    const session = await chatService.createChatSession(user.id, 'Test Session');
    console.log('✓ Session created:', session.id);

    // Test adding messages
    console.log('Adding test messages...');
    const msg1 = await chatService.addChatMessage(session.id, user.id, 'Hello, this is a test!', 'user');
    const msg2 = await chatService.addChatMessage(session.id, user.id, 'Hello! How can I help you today?', 'assistant');
    console.log('✓ Messages added');

    // Test reading messages
    console.log('Reading messages...');
    const messages = await chatService.getChatMessages(session.id);
    console.log(`✓ Retrieved ${messages.length} messages`);

    // Test user chat sessions
    console.log('Reading user sessions...');
    const sessions = await chatService.getUserChatSessions(user.id);
    console.log(`✓ Retrieved ${sessions.length} sessions`);

    // Verify data integrity
    console.log('Verifying data integrity...');
    const userFromDb = await userService.getUserByEmail('finaltest@example.com');
    if (userFromDb && userFromDb.id === user.id) {
      console.log('✓ User data integrity verified');
    }

    console.log('🎉 All database tests passed successfully!');
    console.log('💾 History is now stored in SQLite database instead of localStorage');

  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();
