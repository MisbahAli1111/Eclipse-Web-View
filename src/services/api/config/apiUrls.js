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
      search: 'https://silver.dev.eclipsescheduling.com/api/tenant-users/search',
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
      search: 'https://gold.stage.eclipsescheduling.com/api/tenant-users/search',
    }
  },
  
  production: {
    tenant: {
      base: (tenantId) => `https://${tenantId}.v4.eclipsescheduling.com`,
      auth: {
        token: (tenantId) => `https://${tenantId}.v4.eclipsescheduling.com/api/auth/login`,
      },
      dashboard: (tenantId) => `https://${tenantId}.v4.eclipsescheduling.com/`,
    },
    tenantSearch: {
      search: 'https://qavi.v4.eclipsescheduling.com/api/tenant-users/search',
    }
  }
};
