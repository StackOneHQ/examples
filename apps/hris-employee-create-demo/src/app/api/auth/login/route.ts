import { NextRequest, NextResponse } from 'next/server';
import { dbMethods } from '@/lib/database';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await dbMethods.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create session
    const sessionId = createSession(user.id, user.username);

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username
      },
      sessionId
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
