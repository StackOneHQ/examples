import { NextRequest, NextResponse } from 'next/server';
import { dbMethods } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    const STACKONE_API_KEY = process.env.STACKONE_API_KEY;
    
    if (!STACKONE_API_KEY) {
      return NextResponse.json(
        { success: false, message: 'StackOne API key not configured' },
        { status: 500 }
      );
    }

    // Get active account IDs from our local database
    const activeAccounts = await dbMethods.all('SELECT DISTINCT account_id FROM integrations WHERE status = ? AND account_id IS NOT NULL', ['active']) as Array<{ account_id: string }>;
    
    if (activeAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        logs: [],
        total: 0,
        page,
        limit,
        source: 'stackone',
        accountCount: 0,
        message: 'No active integrations found'
      });
    }

    // Prepare headers for StackOne API
    const headers = {
      'Authorization': `Basic ${Buffer.from(STACKONE_API_KEY + ':' + '').toString('base64')}`,
      'Content-Type': 'application/json',
    };

    // Use the correct StackOne endpoint for step logs
    const stackoneUrl = `https://api.stackone.com/requests/logs/steps?page_size=${limit}`;
    
    const response = await fetch(stackoneUrl, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('StackOne API error:', errorText);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch logs from StackOne API' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Filter logs by our active account IDs
    const activeAccountIds = activeAccounts.map(acc => acc.account_id);
    const filteredLogs = data.data?.filter((log: any) => 
      activeAccountIds.includes(log.account_id)
    ) || [];
    
    // Transform StackOne logs to match our expected format
    const logs = filteredLogs.map((log: any) => ({
      id: log.id,
      user_id: 'demo-user-id', // In production, get from session
      integration_id: log.account_id,
      operation: log.action || log.path || 'api_request',
      status: log.success ? 'success' : 'error',
      request_data: JSON.stringify({
        method: log.http_method,
        path: log.path,
        url: log.url,
        provider: log.provider,
        service: log.service,
        resource: log.resource
      }),
      response_data: JSON.stringify({
        status: log.status,
        duration: log.duration,
        success: log.success
      }),
      error_message: log.success ? null : 'Request failed',
      created_at: log.start_time || new Date().toISOString(),
      provider_name: log.provider || 'Unknown Provider'
    }));

    return NextResponse.json({
      success: true,
      logs,
      total: filteredLogs.length,
      page,
      limit,
      source: 'stackone',
      accountCount: activeAccountIds.length
    });

  } catch (error) {
    console.error('Logs fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
