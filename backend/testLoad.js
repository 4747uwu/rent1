import axios from 'axios';

// ============================================
// CONFIGURATION - FROM YOUR SCREENSHOT
// ============================================
const API_BASE_URL = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'aiteleradiology@gmail.com';
const ADMIN_PASSWORD = '9414484317';

const RUNS_PER_TEST = 3;

// ============================================
// AXIOS INSTANCE
// ============================================
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    withCredentials: true
});

// ============================================
// COLORS FOR TERMINAL
// ============================================
const C = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};

function colorize(color, text) { return `${C[color]}${text}${C.reset}`; }
function bold(text) { return `${C.bright}${text}${C.reset}`; }

function speedBadge(ms) {
    if (ms < 100) return colorize('green', `⚡ ${ms}ms FAST`);
    if (ms < 300) return colorize('green', `✅ ${ms}ms GOOD`);
    if (ms < 600) return colorize('yellow', `⚠️  ${ms}ms OK`);
    if (ms < 1200) return colorize('yellow', `🐢 ${ms}ms SLOW`);
    return colorize('red', `❌ ${ms}ms CRITICAL`);
}

function log(msg) {
    console.log(`${colorize('cyan', `[${new Date().toISOString().slice(11, 23)}]`)} ${msg}`);
}

function section(title) {
    console.log('\n' + colorize('blue', '═'.repeat(70)));
    console.log(bold(colorize('blue', `  ${title}`)));
    console.log(colorize('blue', '═'.repeat(70)));
}

// ============================================
// AUTH
// ============================================
let authToken = null;
let userInfo = null;

async function login() {
    section('🔐 AUTHENTICATION');
    log(`Email: ${ADMIN_EMAIL}`);
    log(`URL:   ${API_BASE_URL}/auth/login`);

    try {
        const res = await api.post('/auth/login', {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        // Your auth.controller returns: { success, token, user, redirectTo }
        authToken = res.data?.token;
        userInfo = res.data?.user;

        if (!authToken) {
            throw new Error(`No token received. Response: ${JSON.stringify(res.data).slice(0, 200)}`);
        }

        // Set token for all future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

        log(colorize('green', `✅ Login SUCCESS`));
        log(`   Role:     ${bold(userInfo?.role)}`);
        log(`   Name:     ${userInfo?.fullName || userInfo?.username}`);
        log(`   Org:      ${userInfo?.organizationIdentifier}`);
        log(`   Redirect: ${res.data?.redirectTo}`);

        return authToken;
    } catch (err) {
        const errMsg = err.response?.data?.message || err.message;
        const status = err.response?.status;
        log(colorize('red', `❌ Login FAILED [${status}]: ${errMsg}`));
        log(`   Full response: ${JSON.stringify(err.response?.data)}`);
        throw err;
    }
}

// ============================================
// TIMED FETCH
// ============================================
async function timedFetch(label, endpoint, params = {}) {
    const start = Date.now();
    try {
        const res = await api.get(endpoint, { params });
        const ms = Date.now() - start;
        const data = res.data;

        return {
            success: true,
            ms,
            count: data?.data?.length ?? 0,
            total: data?.pagination?.totalRecords ?? data?.totalRecords ?? 0,
            totalPages: data?.pagination?.totalPages ?? 0,
            currentPage: data?.pagination?.currentPage ?? params.page ?? 1,
            limit: data?.pagination?.limit ?? params.limit ?? 50,
            hasNextPage: data?.pagination?.hasNextPage ?? false,
            status: res.status,
            label
        };
    } catch (err) {
        const ms = Date.now() - start;
        return {
            success: false,
            ms,
            count: 0,
            total: 0,
            error: err.response?.data?.message || err.message,
            status: err.response?.status,
            label
        };
    }
}

// ============================================
// AVERAGE N RUNS
// ============================================
async function avgRuns(fn, runs = RUNS_PER_TEST) {
    const results = [];
    for (let i = 0; i < runs; i++) {
        results.push(await fn());
        if (i < runs - 1) await sleep(80);
    }
    const durations = results.map(r => r.ms);
    return {
        ...results[results.length - 1],
        avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / runs),
        minMs: Math.min(...durations),
        maxMs: Math.max(...durations),
        runs
    };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================
// PRINT RESULT ROW
// ============================================
function printRow(result) {
    if (!result.success) {
        console.log(
            `  ${colorize('red', '❌')} ${result.label.padEnd(50)} ` +
            `${colorize('red', result.error || 'FAILED')} [${result.status}]`
        );
        return;
    }

    const badge = speedBadge(result.avgMs ?? result.ms);
    const records = `${result.count}/${result.total}`;
    const minMax = result.minMs !== undefined
        ? colorize('white', ` (min:${result.minMs} max:${result.maxMs})`)
        : '';

    console.log(
        `  ${result.label.padEnd(50)} ` +
        `${badge} ${minMax} ` +
        `${colorize('cyan', `[${records} records]`)}`
    );
}

// ============================================
// TEST RESULTS COLLECTOR
// ============================================
const allResults = [];
function record(result) {
    allResults.push(result);
    return result;
}

// ============================================
// TEST 1: Dashboard Category Values
// ============================================
async function test1_Dashboard() {
    section('📊 TEST 1: Dashboard Category Counts (Admin /values endpoints)');

    const endpoints = [
        { label: 'GET /admin/values (main dashboard values)', endpoint: '/admin/values' },
        { label: 'GET /admin/category-values', endpoint: '/admin/category-values' },
    ];

    for (const e of endpoints) {
        const r = await avgRuns(() => timedFetch(e.label, e.endpoint));
        printRow(r);
        record(r);
    }
}

// ============================================
// TEST 2: Basic Pagination - Page 1
// ============================================
async function test2_BasicPagination() {
    section('📄 TEST 2: Basic Pagination - Page 1 (Default Admin Dashboard Load)');

    const pageSizeCases = [
        { label: 'limit=10  page=1 (Admin default)', endpoint: '/admin/studies', params: { page: 1, limit: 10, dateFilter: 'today' } },
        { label: 'limit=20  page=1', endpoint: '/admin/studies', params: { page: 1, limit: 20, dateFilter: 'today' } },
        { label: 'limit=50  page=1', endpoint: '/admin/studies', params: { page: 1, limit: 50, dateFilter: 'today' } },
        { label: 'limit=100 page=1', endpoint: '/admin/studies', params: { page: 1, limit: 100, dateFilter: 'today' } },
        { label: 'limit=50  page=1 (last7days)', endpoint: '/admin/studies', params: { page: 1, limit: 50, dateFilter: 'last7days' } },
        { label: 'limit=50  page=1 (last30days)', endpoint: '/admin/studies', params: { page: 1, limit: 50, dateFilter: 'last30days' } },
        { label: 'limit=50  page=1 (NO date filter)', endpoint: '/admin/studies', params: { page: 1, limit: 50 } },
    ];

    for (const tc of pageSizeCases) {
        const r = await avgRuns(() => timedFetch(tc.label, tc.endpoint, tc.params));
        printRow(r);
        record(r);
    }
}

// ============================================
// TEST 3: Category Endpoints
// ============================================
async function test3_CategoryEndpoints() {
    section('🗂️  TEST 3: Category Endpoints (Admin Worklist Tabs)');

    const categories = [
        { label: 'GET /admin/studies (all)',                        endpoint: '/admin/studies',                              params: { page: 1, limit: 50, dateFilter: 'last30days' } },
        { label: 'GET /admin/studies/category/unassigned',          endpoint: '/admin/studies/category/unassigned',          params: { page: 1, limit: 50 } },
        { label: 'GET /admin/studies/category/assigned',            endpoint: '/admin/studies/category/assigned',            params: { page: 1, limit: 50 } },
        { label: 'GET /admin/studies/category/pending',             endpoint: '/admin/studies/category/pending',             params: { page: 1, limit: 50 } },
        { label: 'GET /admin/studies/category/draft',               endpoint: '/admin/studies/category/draft',               params: { page: 1, limit: 50 } },
        { label: 'GET /admin/studies/category/verification-pending',endpoint: '/admin/studies/category/verification-pending',params: { page: 1, limit: 50 } },
        { label: 'GET /admin/studies/category/final',               endpoint: '/admin/studies/category/final',               params: { page: 1, limit: 50 } },
        { label: 'GET /admin/studies/category/urgent',              endpoint: '/admin/studies/category/urgent',              params: { page: 1, limit: 50 } },
        { label: 'GET /admin/studies/category/reverted',            endpoint: '/admin/studies/category/reverted',            params: { page: 1, limit: 50 } },
    ];

    for (const tc of categories) {
        const r = await avgRuns(() => timedFetch(tc.label, tc.endpoint, tc.params));
        printRow(r);
        record(r);
    }
}

// ============================================
// TEST 4: Deep Pagination Stress Test
// ============================================
async function test4_DeepPagination() {
    section('🕳️  TEST 4: Deep Pagination (Page 1 → 1000)');

    // First get total count
    const first = await timedFetch('probe', '/admin/studies', { page: 1, limit: 1 });
    const totalRecords = first.total;
    const maxPagesAt50 = Math.ceil(totalRecords / 50);

    log(`Total records: ${bold(totalRecords.toLocaleString())} | Max pages at limit=50: ${bold(maxPagesAt50)}`);

    const pagesToTest = [1, 2, 5, 10, 25, 50, 100, 200, 500, 999]
        .filter(p => p <= maxPagesAt50);

    for (const page of pagesToTest) {
        const r = await avgRuns(() =>
            timedFetch(`Deep page=${page} limit=50`, '/admin/studies', { page, limit: 50 })
        );
        printRow(r);
        record(r);
    }
}

// ============================================
// TEST 5: Search & Filter Speed
// ============================================
async function test5_SearchFilters() {
    section('🔍 TEST 5: Search & Filter Combinations');

    const searchCases = [
        { label: 'Search: "SHARMA" (patient name)',              endpoint: '/admin/studies', params: { search: 'SHARMA', page: 1, limit: 50 } },
        { label: 'Search: "GUPTA"',                              endpoint: '/admin/studies', params: { search: 'GUPTA', page: 1, limit: 50 } },
        { label: 'Search: "CT Chest" (description)',             endpoint: '/admin/studies', params: { search: 'CT Chest', page: 1, limit: 50 } },
        { label: 'Filter: modality=CT',                          endpoint: '/admin/studies', params: { modality: 'CT', page: 1, limit: 50, dateFilter: 'last30days' } },
        { label: 'Filter: modality=MR',                          endpoint: '/admin/studies', params: { modality: 'MR', page: 1, limit: 50, dateFilter: 'last30days' } },
        { label: 'Filter: modality=CR',                          endpoint: '/admin/studies', params: { modality: 'CR', page: 1, limit: 50, dateFilter: 'last30days' } },
        { label: 'Filter: priority=EMERGENCY',                   endpoint: '/admin/studies', params: { priority: 'EMERGENCY', page: 1, limit: 50 } },
        { label: 'Filter: priority=STAT',                        endpoint: '/admin/studies', params: { priority: 'STAT', page: 1, limit: 50 } },
        { label: 'Filter: dateFilter=today',                     endpoint: '/admin/studies', params: { dateFilter: 'today', page: 1, limit: 50 } },
        { label: 'Filter: dateFilter=last7days',                 endpoint: '/admin/studies', params: { dateFilter: 'last7days', page: 1, limit: 50 } },
        { label: 'Filter: dateFilter=last30days',                endpoint: '/admin/studies', params: { dateFilter: 'last30days', page: 1, limit: 50 } },
        { label: 'Filter: dateFilter=thisMonth',                 endpoint: '/admin/studies', params: { dateFilter: 'thisMonth', page: 1, limit: 50 } },
        // ✅ NEW DATE FILTERS
        { label: 'Filter: dateFilter=last3months',               endpoint: '/admin/studies', params: { dateFilter: 'last3months', page: 1, limit: 50 } },
        { label: 'Filter: dateFilter=last6months',               endpoint: '/admin/studies', params: { dateFilter: 'last6months', page: 1, limit: 50 } },
        { label: 'Filter: dateFilter=last1year',                 endpoint: '/admin/studies', params: { dateFilter: 'last1year', page: 1, limit: 50 } },
        { label: 'Filter: dateFilter=last18months',              endpoint: '/admin/studies', params: { dateFilter: 'last18months', page: 1, limit: 50 } },
        { label: 'Combined: CT + last6months + page=2',          endpoint: '/admin/studies', params: { modality: 'CT', dateFilter: 'last6months', page: 2, limit: 50 } },
        { label: 'Combined: CT + last7days + page=2',            endpoint: '/admin/studies', params: { modality: 'CT', dateFilter: 'last7days', page: 2, limit: 50 } },
        { label: 'Combined: MR + STAT priority',                 endpoint: '/admin/studies', params: { modality: 'MR', priority: 'STAT', page: 1, limit: 50 } },
        { label: 'Combined: MR + last1year',                     endpoint: '/admin/studies', params: { modality: 'MR', dateFilter: 'last1year', page: 1, limit: 50 } },
    ];

    for (const tc of searchCases) {
        const r = await avgRuns(() => timedFetch(tc.label, tc.endpoint, tc.params));
        printRow(r);
        record(r);
    }
}

// ============================================
// TEST 6: Concurrent Requests (Multi-user sim)
// ============================================
async function test6_Concurrency() {
    section('🔀 TEST 6: Concurrency Test (Simulating Multiple Users)');

    const concurrencyLevels = [1, 3, 5, 10, 15, 20, 30];

    const summary = [];

    for (const concurrency of concurrencyLevels) {
        const wallStart = Date.now();

        const promises = Array.from({ length: concurrency }, (_, i) => {
            const pages = [1, 2, 3, 4, 5];
            const page = pages[i % pages.length];
            const filters = [
                { dateFilter: 'today', page, limit: 50 },
                { dateFilter: 'last7days', page, limit: 50 },
                { modality: 'CT', page, limit: 50 },
                { dateFilter: 'last30days', page: 1, limit: 100 },
                { page, limit: 50 }
            ];
            return timedFetch(`c${concurrency}_req${i}`, '/admin/studies', filters[i % filters.length]);
        });

        const results = await Promise.all(promises);
        const wallMs = Date.now() - wallStart;

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / concurrency);
        const maxMs = Math.max(...results.map(r => r.ms));
        const minMs = Math.min(...results.map(r => r.ms));
        const throughput = ((concurrency / wallMs) * 1000).toFixed(1);

        const statusIcon = failed > 0 ? colorize('red', '❌') :
                           maxMs > 1000 ? colorize('yellow', '⚠️ ') :
                           colorize('green', '✅');

        console.log(
            `  ${statusIcon} ${bold(String(concurrency).padStart(2) + ' concurrent')}  ` +
            `wall=${colorize('cyan', wallMs + 'ms')}  ` +
            `avg=${speedBadge(avgMs)}  ` +
            `min=${colorize('green', minMs + 'ms')}  ` +
            `max=${colorize('red', maxMs + 'ms')}  ` +
            `throughput=${colorize('magenta', throughput + ' req/s')}  ` +
            `${failed > 0 ? colorize('red', `FAILED:${failed}`) : colorize('green', `OK:${successful}/${concurrency}`)}`
        );

        summary.push({ concurrency, wallMs, avgMs, maxMs, minMs, throughput, successful, failed });
        await sleep(200); // Cool down between levels
    }

    return summary;
}

// ============================================
// TEST 7: Pagination Navigation Simulation
// (What a real user does clicking through pages)
// ============================================
async function test7_UserJourney() {
    section('👤 TEST 7: Real User Navigation Simulation');

    log('Simulating: User opens dashboard → browses pages → filters → searches');
    console.log('');

    const steps = [
        { label: '① Open dashboard (today filter, page 1)',       endpoint: '/admin/studies', params: { dateFilter: 'today', page: 1, limit: 50 } },
        { label: '② Click next page (page 2)',                    endpoint: '/admin/studies', params: { dateFilter: 'today', page: 2, limit: 50 } },
        { label: '③ Click next page (page 3)',                    endpoint: '/admin/studies', params: { dateFilter: 'today', page: 3, limit: 50 } },
        { label: '④ Change filter to last7days (resets to p1)',   endpoint: '/admin/studies', params: { dateFilter: 'last7days', page: 1, limit: 50 } },
        { label: '⑤ Change limit to 100',                         endpoint: '/admin/studies', params: { dateFilter: 'last7days', page: 1, limit: 100 } },
        { label: '⑥ Click "Unassigned" tab',                      endpoint: '/admin/studies/category/unassigned', params: { page: 1, limit: 50 } },
        { label: '⑦ Click "Assigned" tab',                        endpoint: '/admin/studies/category/assigned', params: { page: 1, limit: 50 } },
        { label: '⑧ Click "Urgent" tab',                          endpoint: '/admin/studies/category/urgent', params: { page: 1, limit: 50 } },
        { label: '⑨ Search by name "SHARMA"',                    endpoint: '/admin/studies', params: { search: 'SHARMA', page: 1, limit: 50 } },
        { label: '⑩ Filter by CT modality',                       endpoint: '/admin/studies', params: { modality: 'CT', page: 1, limit: 50 } },
        { label: '⑪ Refresh (same filters)',                       endpoint: '/admin/studies', params: { modality: 'CT', page: 1, limit: 50 } },
        { label: '⑫ Go back to "All" tab last30days',             endpoint: '/admin/studies', params: { dateFilter: 'last30days', page: 1, limit: 50 } },
    ];

    let totalMs = 0;
    for (const step of steps) {
        const r = await timedFetch(step.label, step.endpoint, step.params);
        const badge = speedBadge(r.ms);
        console.log(
            `  ${r.success ? '' : colorize('red', '❌')} ${step.label.padEnd(55)} ${badge}  ${colorize('cyan', `[${r.count}/${r.total}]`)}`
        );
        totalMs += r.ms;
        record(r);
        await sleep(50); // Small user think time
    }

    console.log('');
    console.log(`  ${bold('Total user journey time:')} ${colorize('cyan', totalMs + 'ms')} for ${steps.length} steps`);
    console.log(`  ${bold('Average per step:')}        ${colorize('cyan', Math.round(totalMs / steps.length) + 'ms')}`);
}

// ============================================
// FINAL REPORT
// ============================================
function finalReport() {
    section('📊 FINAL PERFORMANCE REPORT');

    const successful = allResults.filter(r => r.success);
    const failed = allResults.filter(r => !r.success);

    if (successful.length === 0) {
        console.log(colorize('red', '  No successful results to analyze!'));
        return;
    }

    const times = successful.map(r => r.avgMs ?? r.ms);
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const p50 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)];
    const p90 = times[Math.floor(times.length * 0.9)];
    const p99 = times[Math.floor(times.length * 0.99)] ?? max;

    console.log(`\n  ${bold('Overall Stats:')}`);
    console.log(`  ├─ Tests run:    ${allResults.length}`);
    console.log(`  ├─ Successful:   ${colorize('green', successful.length)}`);
    console.log(`  ├─ Failed:       ${failed.length > 0 ? colorize('red', failed.length) : colorize('green', 0)}`);
    console.log(`  ├─ Min response: ${colorize('green', min + 'ms')}`);
    console.log(`  ├─ Max response: ${colorize('red', max + 'ms')}`);
    console.log(`  ├─ Average:      ${speedBadge(avg)}`);
    console.log(`  ├─ P50 (median): ${speedBadge(p50)}`);
    console.log(`  ├─ P90:          ${speedBadge(p90)}`);
    console.log(`  └─ P99:          ${speedBadge(p99)}`);

    // Slow queries
    const slow = successful.filter(r => (r.avgMs ?? r.ms) > 500).sort((a, b) => (b.avgMs ?? b.ms) - (a.avgMs ?? a.ms));
    if (slow.length > 0) {
        console.log(`\n  ${bold(colorize('red', '🚨 SLOW QUERIES (>500ms):'))}`);
        slow.forEach(r => {
            console.log(`  ❌ ${r.label} → ${colorize('red', (r.avgMs ?? r.ms) + 'ms')}`);
        });
    }

    // Failed
    if (failed.length > 0) {
        console.log(`\n  ${bold(colorize('red', '💥 FAILED REQUESTS:'))}`);
        failed.forEach(r => {
            console.log(`  ❌ ${r.label} → ${r.error} [HTTP ${r.status}]`);
        });
    }

    // Grade
    const grade =
        p90 < 200 ? '🏆 A+ EXCELLENT' :
        p90 < 400 ? '✅ A  GREAT' :
        p90 < 700 ? '🟡 B  GOOD' :
        p90 < 1200 ? '⚠️  C  NEEDS WORK' :
        '❌ D  NEEDS OPTIMIZATION';

    console.log(`\n  ${bold('Performance Grade:')} ${bold(grade)}`);

    // Recommendations
    console.log(`\n  ${bold('💡 Recommendations:')}`);
    if (p90 > 500) {
        console.log('  ⚠️  Add compound indexes: { organizationIdentifier: 1, createdAt: -1 }');
        console.log('  ⚠️  Add compound indexes: { organizationIdentifier: 1, workflowStatus: 1, createdAt: -1 }');
    }
    if (max > 1000) {
        console.log('  ⚠️  Deep pagination slow - consider cursor-based pagination for page > 100');
    }
    if (p90 < 300) {
        console.log('  ✅ Queries fast! Next: add Redis caching for dashboard count values');
    }
    if (slow.some(r => r.label.includes('Search'))) {
        console.log('  ⚠️  Search is slow - add text index on patientInfo.patientName, examDescription');
    }

    console.log('\n' + colorize('blue', '═'.repeat(70)) + '\n');
}

// ============================================
// MAIN
// ============================================
async function main() {
    console.clear();
    console.log(colorize('magenta', bold(`
╔══════════════════════════════════════════════════════════════════════╗
║         BHARATPACS WORKLIST PAGINATION PERFORMANCE TEST              ║
║                    Organization: BTTK                                ║
╚══════════════════════════════════════════════════════════════════════╝
    `)));

    log(`API:      ${bold(API_BASE_URL)}`);
    log(`Email:    ${bold(ADMIN_EMAIL)}`);
    log(`Runs/test:${bold(RUNS_PER_TEST)}`);

    try {
        await login();
    } catch {
        console.log(colorize('red', '\n❌ Cannot proceed without auth. Check email/password and server URL.'));
        process.exit(1);
    }

    try {
        await test1_Dashboard();
        await test2_BasicPagination();
        await test3_CategoryEndpoints();
        await test4_DeepPagination();
        await test5_SearchFilters();
        await test6_Concurrency();
        await test7_UserJourney();
        finalReport();
    } catch (err) {
        log(colorize('red', `Test suite crashed: ${err.message}`));
        console.error(err);
        finalReport(); // Still print whatever we got
    }
}

main();