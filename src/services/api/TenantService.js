import { getTenantSearchUrl } from './config';

export const TenantService = {
  async getTenants(email, password) {
    try {
      const response = await fetch(getTenantSearchUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (data.success) {
        return {
          success: true,
          tenants: data.data,
          count: data.count
        };
      } else {
        throw new Error(data.message || 'Failed to fetch tenants');
      }
    } catch (error) {
      throw error;
    }
  }
};