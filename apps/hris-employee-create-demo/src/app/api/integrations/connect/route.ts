import { NextRequest, NextResponse } from 'next/server';
import { dbMethods } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import stackoneClient from '@/lib/stackone';
import { getCurrentUser } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { provider_key, provider_name, stackone_account_id } = await request.json();

    if (!provider_key || !provider_name) {
      return NextResponse.json(
        { success: false, message: 'Provider key and name are required' },
        { status: 400 }
      );
    }

    // Get current user from session
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use StackOne account ID if provided, otherwise generate a demo one
    const accountId = stackone_account_id || `acc_${uuidv4()}`;
    const integrationId = uuidv4();

    // Store integration in database
    await dbMethods.run(`
      INSERT INTO integrations (id, user_id, provider_key, provider_name, account_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [integrationId, currentUser.id, provider_key, provider_name, accountId, 'active']);

    // Note: Logging removed - using StackOne logs only

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${provider_name}`,
      account_id: accountId
    });

  } catch (error) {
    console.error('Integration connect error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to connect integration' },
      { status: 500 }
    );
  }
}
