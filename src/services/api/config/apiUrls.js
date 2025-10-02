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
      base: (tenantId) => `https://${tenantId}.stg-tenant.eclipsescheduling.com`,
      auth: {
        token: (tenantId) => `https://${tenantId}.stg-tenant.eclipsescheduling.com/api/auth/token`,
      },
      dashboard: (tenantId) => `https://${tenantId}.stg-tenant.eclipsescheduling.com/v1/provider/dashboard`,
    },
    tenantSearch: {
      search: 'https://test.stg-tenant.eclipsescheduling.com/api/tenant-users/search',
    }
  },
  
  production: {
    tenant: {
      base: (tenantId) => `https://${tenantId}.eclipsescheduling.com`,
      auth: {
        token: (tenantId) => `https://${tenantId}.eclipsescheduling.com/api/auth/token`,
      },
      dashboard: (tenantId) => `https://${tenantId}.eclipsescheduling.com/v1/provider/dashboard`,
    },
    tenantSearch: {
      search: 'https://qavi.eclipsescheduling.com/api/tenant-users/search',
    }
  }
};
