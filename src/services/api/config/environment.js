import { API_URLS } from './apiUrls';

// Environment Configuration
// Change this to switch between environments: 'development', 'staging', or 'production'
// const CURRENT_ENVIRONMENT = 'development';
// const CURRENT_ENVIRONMENT = 'staging';
// const CURRENT_ENVIRONMENT = 'production';
const CURRENT_ENVIRONMENT = 'play';

// Get the current environment's API URLs
export const getApiUrls = () => {
  return API_URLS[CURRENT_ENVIRONMENT];
};

// Helper function to get specific URL types
export const getAuthUrl = (tenantId) => {
  return getApiUrls().tenant.auth.token(tenantId);
};

export const getTenantSearchUrl = () => {
  return getApiUrls().tenantSearch?.search;
};

export const getLoginUrl = () => {
  const urls = getApiUrls();
  return urls.login || (urls.tenant?.auth?.token?.('bronze'));
};

export const getDashboardUrl = (tenantId) => {
  const urls = getApiUrls();
  if (urls.dashboard) return urls.dashboard;
  return urls.tenant?.dashboard?.(tenantId);
};

// Environment info
export const getCurrentEnvironment = () => CURRENT_ENVIRONMENT;
export const isDevelopment = () => CURRENT_ENVIRONMENT === 'development';
export const isStaging = () => CURRENT_ENVIRONMENT === 'staging';
export const isProduction = () => CURRENT_ENVIRONMENT === 'production';
export const isPlay = () => CURRENT_ENVIRONMENT === 'play';
