class SessionManager {
    constructor() {
      this.TOKEN_KEY = 'auth_token';
      this.USER_KEY = 'auth_user';
      this.EXPIRES_KEY = 'auth_expires';
      this.ORG_CONTEXT_KEY = 'org_context';
      this.API_URL = '/api'; 
    }
  
    // Store session data with organization context
    setSession(token, user, expiresIn, organizationContext = null) {
      const expiresAt = new Date(Date.now() + this.parseExpiration(expiresIn)).getTime();
      
      sessionStorage.setItem(this.TOKEN_KEY, token);
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(user));
      sessionStorage.setItem(this.EXPIRES_KEY, expiresAt.toString());
      
      if (organizationContext) {
        sessionStorage.setItem(this.ORG_CONTEXT_KEY, organizationContext);
      } else {
        sessionStorage.removeItem(this.ORG_CONTEXT_KEY);
      }
      
      console.log('✅ Session stored:', { user: user.email, context: organizationContext });
    }
  
    // Get session data with organization context
    getSession() {
      try {
        const token = sessionStorage.getItem(this.TOKEN_KEY);
        const userStr = sessionStorage.getItem(this.USER_KEY);
        const expiresAt = sessionStorage.getItem(this.EXPIRES_KEY);
        const organizationContext = sessionStorage.getItem(this.ORG_CONTEXT_KEY);

        if (!token || !userStr || !expiresAt) {
          return null;
        }

        // Check if token is expired
        if (Date.now() > parseInt(expiresAt)) {
          this.clearSession();
          return null;
        }

        return {
          token,
          user: JSON.parse(userStr),
          expiresAt: parseInt(expiresAt),
          organizationContext
        };
      } catch (error) {
        console.error('Error getting session:', error);
        this.clearSession();
        return null;
      }
    }
  
    // Clear session data
    clearSession() {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.USER_KEY);
      sessionStorage.removeItem(this.EXPIRES_KEY);
      sessionStorage.removeItem(this.ORG_CONTEXT_KEY);
      console.log('🗑️ Session cleared');
    }
  
    // Check if session exists and is valid
    isAuthenticated() {
      const session = this.getSession();
      return session !== null;
    }
  
    // Get current user
    getCurrentUser() {
      const session = this.getSession();
      return session ? session.user : null;
    }
  
    // Get current token
    getToken() {
      const session = this.getSession();
      return session ? session.token : null;
    }

    // Get organization context
    getOrganizationContext() {
      const session = this.getSession();
      return session ? session.organizationContext : null;
    }
  
    // Parse expiration time
    parseExpiration(expiresIn) {
      const units = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
      };

      const match = expiresIn.match(/^(\d+)([smhd])$/);
      if (match) {
        const [, value, unit] = match;
        return parseInt(value) * units[unit];
      }

      return 60 * 60 * 1000; // Default 1 hour
    }
  
    // Auto-refresh token
    async refreshTokenIfNeeded() {
      const session = this.getSession();
      if (!session) return false;

      const fiveMinutes = 5 * 60 * 1000;
      if (session.expiresAt - Date.now() < fiveMinutes) {
        try {
          const response = await fetch(`${this.API_URL}/auth/refresh-token`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            this.setSession(
              data.token, 
              session.user, 
              data.expiresIn, 
              session.organizationContext
            );
            console.log('🔄 Token refreshed successfully');
            return true;
          } else {
            console.log('❌ Token refresh failed:', response.status);
            this.clearSession();
          }
        } catch (error) {
          console.error('Failed to refresh token:', error);
          this.clearSession();
        }
      }

      return false;
    }
  }
  
  export default new SessionManager();