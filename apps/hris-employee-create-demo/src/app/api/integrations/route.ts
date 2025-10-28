import { NextResponse } from 'next/server';
import { dbMethods } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const integrations = await dbMethods.all('SELECT * FROM integrations ORDER BY created_at DESC');

    return NextResponse.json({
      success: true,
      integrations
    });

  } catch (error) {
    console.error('Integrations fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}
