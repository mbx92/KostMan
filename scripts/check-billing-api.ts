#!/usr/bin/env tsx
/**
 * API Health Check for Billing Endpoints
 * 
 * Quick check to verify billing API endpoints are responding
 * No authentication needed - just checks if endpoints exist
 * 
 * Usage:
 *   npx tsx scripts/check-billing-api.ts
 */

import 'dotenv/config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
};

interface EndpointCheck {
    method: string;
    path: string;
    expectedStatus: number[];
    description: string;
}

const endpoints: EndpointCheck[] = [
    {
        method: 'GET',
        path: '/api/bills',
        expectedStatus: [200, 401], // 401 if not authenticated
        description: 'List bills endpoint',
    },
    {
        method: 'POST',
        path: '/api/bills/generate',
        expectedStatus: [200, 400, 401], // 400 if missing data, 401 if not authenticated
        description: 'Generate bill endpoint',
    },
    {
        method: 'GET',
        path: '/api/rooms',
        expectedStatus: [200, 401],
        description: 'List rooms endpoint (needed for billing)',
    },
    {
        method: 'GET',
        path: '/api/properties',
        expectedStatus: [200, 401],
        description: 'List properties endpoint (needed for billing)',
    },
];

async function checkEndpoint(endpoint: EndpointCheck): Promise<boolean> {
    const url = `${BASE_URL}${endpoint.path}`;

    try {
        const response = await fetch(url, {
            method: endpoint.method,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const isExpected = endpoint.expectedStatus.includes(response.status);

        if (isExpected) {
            console.log(`${c.green}✓${c.reset} ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(30)} [${response.status}] ${endpoint.description}`);
            return true;
        } else {
            console.log(`${c.red}✗${c.reset} ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(30)} [${response.status}] ${endpoint.description}`);
            console.log(`  ${c.yellow}Expected: ${endpoint.expectedStatus.join(' or ')}${c.reset}`);
            return false;
        }
    } catch (error: any) {
        console.log(`${c.red}✗${c.reset} ${endpoint.method.padEnd(6)} ${endpoint.path.padEnd(30)} [ERROR] ${endpoint.description}`);
        console.log(`  ${c.red}${error.message}${c.reset}`);
        return false;
    }
}

async function checkServer(): Promise<boolean> {
    try {
        const response = await fetch(BASE_URL);
        return response.status < 500;
    } catch (error) {
        return false;
    }
}

async function main() {
    console.log(`${c.cyan}╔════════════════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.cyan}║   Billing API Health Check                                 ║${c.reset}`);
    console.log(`${c.cyan}╚════════════════════════════════════════════════════════════╝${c.reset}\n`);

    console.log(`${c.cyan}Server: ${BASE_URL}${c.reset}\n`);

    // Check if server is running
    console.log(`${c.cyan}Checking server...${c.reset}`);
    const serverRunning = await checkServer();

    if (!serverRunning) {
        console.log(`${c.red}✗ Server is not responding at ${BASE_URL}${c.reset}`);
        console.log(`${c.yellow}Make sure your dev server is running: npm run dev${c.reset}\n`);
        process.exit(1);
    }

    console.log(`${c.green}✓ Server is running${c.reset}\n`);

    // Check endpoints
    console.log(`${c.cyan}Checking billing endpoints...${c.reset}\n`);

    const results = await Promise.all(
        endpoints.map(endpoint => checkEndpoint(endpoint))
    );

    const passed = results.filter(r => r).length;
    const total = results.length;

    console.log('');
    console.log(`${c.cyan}═══════════════════════════════════════════════════════════${c.reset}`);

    if (passed === total) {
        console.log(`${c.green}✓ All ${total} endpoints are responding correctly!${c.reset}`);
        console.log(`${c.green}  Billing API is ready for testing.${c.reset}\n`);
        process.exit(0);
    } else {
        console.log(`${c.yellow}⚠ ${passed}/${total} endpoints passed${c.reset}`);
        console.log(`${c.yellow}  Some endpoints may need attention.${c.reset}\n`);
        process.exit(1);
    }
}

main();
