import { NextRequest, NextResponse } from 'next/server';
import { dbMethods } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import stackoneClient from '@/lib/stackone';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const integration = await dbMethods.get('SELECT * FROM integrations WHERE id = ?', id);

    if (!integration) {
      return NextResponse.json(
        { success: false, message: 'Integration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      integration
    });

  } catch (error) {
    console.error('Integration fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch integration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { provider_name, account_id } = await request.json();

    if (!provider_name || !account_id) {
      return NextResponse.json(
        { success: false, message: 'Provider name and account ID are required' },
        { status: 400 }
      );
    }

    // Update the integration
    await dbMethods.run(`
      UPDATE integrations 
      SET provider_name = ?, account_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, provider_name, account_id, id);

    // Get the updated integration
    const integration = await dbMethods.get('SELECT * FROM integrations WHERE id = ?', id);

    if (!integration) {
      return NextResponse.json(
        { success: false, message: 'Integration not found' },
        { status: 404 }
      );
    }

    // Note: Logging removed - using StackOne logs only

    return NextResponse.json({
      success: true,
      message: 'Integration updated successfully',
      integration
    });

  } catch (error) {
    console.error('Integration update error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update integration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Get integration details before deletion
    const integration = await dbMethods.get('SELECT * FROM integrations WHERE id = ?', id);

    if (!integration) {
      return NextResponse.json(
        { success: false, message: 'Integration not found' },
        { status: 404 }
      );
    }

    // Delete the account from StackOne first
    try {
      if (integration.account_id) {
        await stackoneClient.accounts.deleteAccount({
          id: integration.account_id
        });
        console.log(`Successfully deleted StackOne account: ${integration.account_id}`);
      }
    } catch (stackoneError) {
      console.error('Failed to delete StackOne account:', stackoneError);
      // Continue with local deletion even if StackOne deletion fails
    }

    // Delete the integration from local database
    await dbMethods.run('DELETE FROM integrations WHERE id = ?', id);

    // Also clean up any duplicate integrations with the same account_id
    if (integration.account_id) {
      const duplicateCount = await dbMethods.get('SELECT COUNT(*) as count FROM integrations WHERE account_id = ?', integration.account_id) as { count: number };
      if (duplicateCount.count > 0) {
        console.log(`Found ${duplicateCount.count} duplicate integrations with account_id: ${integration.account_id}`);
        await dbMethods.run('DELETE FROM integrations WHERE account_id = ?', integration.account_id);
        console.log(`Cleaned up ${duplicateCount.count} duplicate integrations`);
      }
    }

    // Note: Logging removed - using StackOne logs only

    return NextResponse.json({
      success: true,
      message: 'Integration deleted successfully'
    });
  } catch (error) {
    console.error('Integration deletion error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete integration' },
      { status: 500 }
    );
  }
}