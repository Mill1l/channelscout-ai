import {beforeEach,afterEach,vi} from 'vitest';
// Seed sources are a dated historical snapshot. Freeze only Date, leaving I/O and timers real.
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-01T08:00:00Z'));});
afterEach(()=>vi.useRealTimers());
