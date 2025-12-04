import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Beirut';

/**
 * Convert UTC date from database to Asia/Beirut timezone for display
 */
export const toBeirutTime = (date: string | Date | null | undefined): moment.Moment | null => {
  if (!date) return null;
  try {
    // Convert Date objects to ISO string first to ensure UTC interpretation
    // When dates come from IPC, they're usually ISO strings, but Date objects
    // should be converted to ensure they're treated as UTC
    const dateString = typeof date === 'string' ? date : date.toISOString();
    const utcMoment = moment.utc(dateString);
    return utcMoment.tz(TIMEZONE);
  } catch {
    return null;
  }
};

/**
 * Convert date from Asia/Beirut timezone to UTC for database storage
 */
export const fromBeirutToUTC = (date: Date | moment.Moment | null | undefined): Date | null => {
  if (!date) return null;
  try {
    const beirutMoment = moment.tz(date, TIMEZONE);
    return beirutMoment.utc().toDate();
  } catch {
    return null;
  }
};

/**
 * Convert date from date picker (local time) to UTC ISO string for API
 * Assumes the date picker value is in Beirut timezone context
 */
export const dateToUTCISOString = (date: Date | null | undefined): string | undefined => {
  if (!date) return undefined;
  try {
    const beirutMoment = moment.tz(date, TIMEZONE);
    return beirutMoment.utc().toISOString();
  } catch {
    return undefined;
  }
};

/**
 * Convert date from date picker to UTC date string (YYYY-MM-DD) for API
 * Assumes the date picker value is in Beirut timezone context
 */
export const dateToUTCDateString = (date: Date | null | undefined): string | undefined => {
  if (!date) return undefined;
  try {
    const beirutMoment = moment.tz(date, TIMEZONE);
    return beirutMoment.utc().format('YYYY-MM-DD');
  } catch {
    return undefined;
  }
};

/**
 * Convert UTC date string from API to Date object for date picker
 * The date picker will display it in the user's local timezone, but we treat it as Beirut time
 */
export const utcDateStringToDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null;
  try {
    // Parse as UTC and convert to Beirut timezone, then get the Date object
    const utcMoment = moment.utc(dateString);
    const beirutMoment = utcMoment.tz(TIMEZONE);
    // Return as Date object - date picker will use this
    return beirutMoment.toDate();
  } catch {
    return null;
  }
};

/**
 * Convert UTC Date object from API to Date object for date picker
 */
export const utcDateToDate = (date: Date | null | undefined): Date | null => {
  if (!date) return null;
  try {
    const utcMoment = moment.utc(date);
    const beirutMoment = utcMoment.tz(TIMEZONE);
    return beirutMoment.toDate();
  } catch {
    return null;
  }
};

/**
 * Format date for display in Beirut timezone
 */
export const formatDate = (date: string | Date | null | undefined, format: string = 'MMM DD, YYYY'): string => {
  const beirutTime = toBeirutTime(date);
  if (!beirutTime) return '';
  return beirutTime.format(format);
};

/**
 * Format date with time for display in Beirut timezone
 */
export const formatDateTime = (date: string | Date | null | undefined, format: string = 'MMM DD, YYYY HH:mm'): string => {
  const beirutTime = toBeirutTime(date);
  if (!beirutTime) return '';
  return beirutTime.format(format);
};

/**
 * Convert date range from Beirut timezone to UTC for API
 * Sets start date to beginning of day and end date to end of day in Beirut timezone
 * Supports partial ranges - if only one date is provided, only that date is converted
 */
export const convertDateRangeToUTC = (
  startDate: Date | null | undefined,
  endDate: Date | null | undefined
): { startDate: Date | null; endDate: Date | null } => {
  let startUTC: Date | null = null;
  let endUTC: Date | null = null;

  try {
    // Convert start date if provided
    if (startDate) {
      const startBeirut = moment.tz(startDate, TIMEZONE).startOf('day');
      startUTC = startBeirut.utc().toDate();
    }

    // Convert end date if provided
    if (endDate) {
      const endBeirut = moment.tz(endDate, TIMEZONE).endOf('day');
      endUTC = endBeirut.utc().toDate();
    }

    return { startDate: startUTC, endDate: endUTC };
  } catch {
    return { startDate: null, endDate: null };
  }
};

/**
 * Get current date/time in Beirut timezone as Date object for date picker
 */
export const getCurrentBeirutDate = (): Date => {
  return moment.tz(TIMEZONE).toDate();
};

/**
 * Get start of day in Beirut timezone as Date object
 */
export const getStartOfDayBeirut = (date?: Date | null): Date => {
  const targetDate = date || getCurrentBeirutDate();
  return moment.tz(targetDate, TIMEZONE).startOf('day').toDate();
};

/**
 * Get end of day in Beirut timezone as Date object
 */
export const getEndOfDayBeirut = (date?: Date | null): Date => {
  const targetDate = date || getCurrentBeirutDate();
  return moment.tz(targetDate, TIMEZONE).endOf('day').toDate();
};

/**
 * Calculate relative date ranges in Beirut timezone
 */
export const getRelativeDateRange = (relativeType: string): { startDate: Date; endDate: Date } => {
  const now = moment.tz(TIMEZONE);
  const today = now.clone().startOf('day');
  let startDate: moment.Moment;
  let endDate: moment.Moment = today.clone().endOf('day');

  switch (relativeType) {
    case 'today':
      startDate = today.clone();
      break;
    case '7days':
    case 'last7days':
      startDate = today.clone().subtract(7, 'days');
      break;
    case '30days':
    case 'last30days':
      startDate = today.clone().subtract(30, 'days');
      break;
    case '90days':
    case 'last90days':
      startDate = today.clone().subtract(90, 'days');
      break;
    case 'thisMonth':
      startDate = today.clone().startOf('month');
      endDate = today.clone().endOf('month');
      break;
    case 'lastMonth':
      startDate = today.clone().subtract(1, 'month').startOf('month');
      endDate = today.clone().subtract(1, 'month').endOf('month');
      break;
    case 'thisYear':
      startDate = today.clone().startOf('year');
      endDate = today.clone().endOf('year');
      break;
    default:
      startDate = today.clone().subtract(30, 'days');
  }

  return {
    startDate: startDate.toDate(),
    endDate: endDate.toDate(),
  };
};

