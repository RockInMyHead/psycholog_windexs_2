// Simple test to initialize database and test functionality
import { initializeDatabase } from './src/db/migrations.js';

console.log('Initializing database...');

async function testDatabase() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully!');

    // Now test our database service
    console.log('Testing database service...');
    const { userService, chatService } = await import('./src/services/database.js');

    // Test creating a user
    console.log('Creating test user...');
    const user = await userService.createUser('test@example.com', 'Test User');
    console.log('User created:', user);

    // Test creating a chat session
    console.log('Creating test chat session...');
    const session = await chatService.createChatSession(user.id);
    console.log('Session created:', session);

    // Test creating a message
    console.log('Creating test message...');
    const message = await chatService.addChatMessage(
      session.id,
      user.id,
      'Hello, this is a test message!',
      'user'
    );
    console.log('Message created:', message);

    // Test reading messages
    console.log('Reading messages...');
    const messages = await chatService.getChatMessages(session.id);
    console.log('Messages in session:', messages);

    console.log('Database test completed successfully!');

  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testDatabase();
