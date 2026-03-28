import { Platform } from 'react-native';

// v = app API version, p = platform (m = mobile), d = device (a = Android, i = iOS)
const TENANT_SEARCH_QUERY = `?v=4&p=m&d=${Platform.OS === 'ios' ? 'i' : 'a'}`;

// API URL Configuration
export const API_URLS = {
  development: {
    tenant: {
      base: (tenantId) => `https://${tenantId}.dev.eclipsescheduling.com`,
      auth: {
        token: (tenantId) => `https://${tenantId}.dev.eclipsescheduling.com/api/auth/token`,
      },
      dashboard: (tenantId) => `https://${tenantId}.dev.eclipsescheduling.com/v1/provider/dashboard`,
    },
    tenantSearch: {
      search: `https://silver.dev.eclipsescheduling.com/api/tenant-users/search${TENANT_SEARCH_QUERY}`,
    }
  },

  staging: {
    tenant: {
      base: (tenantId) => `https://${tenantId}.stage.eclipsescheduling.com`,
      auth: {
        token: (tenantId) => `https://${tenantId}.stage.eclipsescheduling.com/api/auth/token`,
      },
      dashboard: (tenantId) => `https://${tenantId}.stage.eclipsescheduling.com/v1/provider/dashboard`,
    },
    tenantSearch: {
      search: `https://gold.stage.eclipsescheduling.com/api/tenant-users/search${TENANT_SEARCH_QUERY}`,
    }
  },
  
  production: {
    tenant: {
      base: (tenantId) => `https://${tenantId}.eclipsescheduling.com`,
      auth: {
        token: (tenantId) => `https://${tenantId}.eclipsescheduling.com/api/auth/login`,
      },
      dashboard: (tenantId) => `https://${tenantId}.eclipsescheduling.com/`,
    },
    tenantSearch: {
      search: `https://qavi.eclipsescheduling.com/api/tenant-users/search${TENANT_SEARCH_QUERY}`,
    }
  }
};
