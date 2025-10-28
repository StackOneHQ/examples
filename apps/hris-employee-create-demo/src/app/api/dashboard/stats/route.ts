import { NextResponse } from 'next/server';
import { dbMethods } from '@/lib/database';

export async function GET() {
  try {
    // Get integration count
    const integrationCount = await dbMethods.get('SELECT COUNT(*) as count FROM integrations WHERE status = ?', ['active']) as { count: number };

    // Get employee creation count
    const employeeCount = await dbMethods.get('SELECT COUNT(*) as count FROM logs WHERE operation = ? AND status = ?', ['create_employee', 'success']) as { count: number };

    return NextResponse.json({
      success: true,
      stats: {
        integrations: integrationCount.count,
        employeesCreated: employeeCount.count
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
