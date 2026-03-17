// ✅ ENHANCED DATE FILTERING UTILITY WITH MORE OPTIONS
export const buildDateFilter = (req) => {
    let filterStartDate = null;
    let filterEndDate = null;
    const now = new Date();

    if (req.query.quickDatePreset || req.query.dateFilter) {
        const preset = req.query.quickDatePreset || req.query.dateFilter;

        console.log('🗓️ DATE FILTER DEBUG:', {
            preset,
            currentTime: now.toISOString(),
            timezone: 'UTC'
        });

        switch (preset) {
            case 'today':
                filterStartDate = new Date(now);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;

            case 'yesterday':
                filterStartDate = new Date(now);
                filterStartDate.setUTCDate(now.getUTCDate() - 1);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setUTCDate(now.getUTCDate() - 1);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;

            case 'last2days':
                filterStartDate = new Date(now);
                filterStartDate.setUTCDate(now.getUTCDate() - 2);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;

            case 'last7days':
                filterStartDate = new Date(now);
                filterStartDate.setUTCDate(now.getUTCDate() - 7);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;

            case 'last30days':
                filterStartDate = new Date(now);
                filterStartDate.setUTCDate(now.getUTCDate() - 30);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;

            case 'thisWeek':
                const currentDay = now.getUTCDay();
                const startOfWeek = new Date(now);
                startOfWeek.setUTCDate(now.getUTCDate() - currentDay);
                startOfWeek.setUTCHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
                endOfWeek.setUTCHours(23, 59, 59, 999);
                filterStartDate = startOfWeek;
                filterEndDate = endOfWeek;
                break;

            case 'lastWeek':
                const lastWeekEnd = new Date(now);
                lastWeekEnd.setUTCDate(now.getUTCDate() - now.getUTCDay() - 1);
                lastWeekEnd.setUTCHours(23, 59, 59, 999);
                const lastWeekStart = new Date(lastWeekEnd);
                lastWeekStart.setUTCDate(lastWeekEnd.getUTCDate() - 6);
                lastWeekStart.setUTCHours(0, 0, 0, 0);
                filterStartDate = lastWeekStart;
                filterEndDate = lastWeekEnd;
                break;

            case 'thisMonth':
                filterStartDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;

            case 'lastMonth':
                filterStartDate = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 0);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;

            case 'thisYear':
                filterStartDate = new Date(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
                filterEndDate = new Date(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999);
                break;

            case 'lastYear':
                filterStartDate = new Date(now.getUTCFullYear() - 1, 0, 1);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now.getUTCFullYear() - 1, 11, 31);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;

            case 'last24h':
                filterStartDate = new Date(now.getTime() - 86400000);
                filterEndDate = new Date(now.getTime());
                break;

            case 'last48h':
                filterStartDate = new Date(now.getTime() - 172800000);
                filterEndDate = new Date(now.getTime());
                break;

            case 'custom':
                if (req.query.customDateFrom && req.query.customDateTo) {
                    filterStartDate = new Date(req.query.customDateFrom + 'T00:00:00.000Z');
                    filterEndDate = new Date(req.query.customDateTo + 'T23:59:59.999Z');
                }
                break;

            default:
                // Default to today if no valid preset
                filterStartDate = new Date(now);
                filterStartDate.setUTCHours(0, 0, 0, 0);
                filterEndDate = new Date(now);
                filterEndDate.setUTCHours(23, 59, 59, 999);
                break;
        }

        if (filterStartDate && filterEndDate) {
            console.log('🎯 FINAL DATE RANGE (UTC):', {
                preset,
                filterStartDate: filterStartDate.toISOString(),
                filterEndDate: filterEndDate.toISOString(),
                range: `${filterStartDate.toISOString()} to ${filterEndDate.toISOString()}`
            });
        }
    }

    // ✅ Custom date range from query params (override preset)
    if (req.query.customDateFrom && req.query.customDateTo) {
        filterStartDate = new Date(req.query.customDateFrom + 'T00:00:00.000Z');
        filterEndDate = new Date(req.query.customDateTo + 'T23:59:59.999Z');
        
        console.log('📅 CUSTOM DATE RANGE (UTC):', {
            from: req.query.customDateFrom,
            to: req.query.customDateTo,
            filterStartDate: filterStartDate.toISOString(),
            filterEndDate: filterEndDate.toISOString()
        });
    }

    return { filterStartDate, filterEndDate };
};