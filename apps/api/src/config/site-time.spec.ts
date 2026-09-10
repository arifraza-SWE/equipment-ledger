import { describeDay, describeInstant, endOfSiteDay, isoDate, siteTimeZone } from './site-time';

describe('the site clock', () => {
  const configuredZone = process.env.SITE_TIMEZONE;

  afterEach(() => {
    if (configuredZone === undefined) {
      delete process.env.SITE_TIMEZONE;
    } else {
      process.env.SITE_TIMEZONE = configuredZone;
    }
  });

  it('runs on UTC unless the site says otherwise', () => {
    delete process.env.SITE_TIMEZONE;
    expect(siteTimeZone()).toBe('UTC');
  });

  it('speaks about an instant as a time on a day', () => {
    delete process.env.SITE_TIMEZONE;
    expect(describeInstant(new Date('2026-09-10T07:45:00Z'))).toBe('07:45 UTC on Thu 10 Sep 2026');
  });

  it('moves the wall clock when the site keeps another zone', () => {
    process.env.SITE_TIMEZONE = 'Europe/London';
    expect(describeInstant(new Date('2026-07-15T07:45:00Z'))).toBe('08:45 BST on Wed 15 Jul 2026');
    expect(describeInstant(new Date('2026-01-15T07:45:00Z'))).toBe('07:45 GMT on Thu 15 Jan 2026');
  });

  it('names the day the site was on, not the day UTC was on', () => {
    process.env.SITE_TIMEZONE = 'Pacific/Auckland';
    const instant = new Date('2026-09-09T23:30:00Z');
    expect(isoDate(instant)).toBe('2026-09-10');
    expect(describeDay(instant)).toBe('Thu 10 Sep 2026');
  });

  it('ends the day on the site clock, so a certificate lapses at the site midnight', () => {
    process.env.SITE_TIMEZONE = 'Europe/London';
    expect(endOfSiteDay(new Date('2026-07-15T09:00:00Z')).toISOString()).toBe(
      '2026-07-15T22:59:59.000Z',
    );
  });
});
