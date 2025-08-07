export const TenantService = {
  async getTenants(email) {
    try {
      const response = await fetch('https://test.stg-tenant.eclipsescheduling.com/api/tenant-users/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email }),
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
      console.error('Tenant fetch error:', error);
      throw error;
    }
  }
};