const fs = require('fs');
const path = require('path');

class CredentialManager {
  constructor() {
    this.credentialsDir = path.join(__dirname, '../data/credentials');
    
    // Ensure the credentials directory exists
    if (!fs.existsSync(this.credentialsDir)) {
      try {
        fs.mkdirSync(this.credentialsDir, { recursive: true });
        console.log('Created credentials directory in CredentialManager:', this.credentialsDir);
      } catch (error) {
        console.error('Error creating credentials directory in CredentialManager:', error);
      }
    }
    
    // Check if we're in a Railway environment
    this.isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
    if (this.isRailway) {
      console.log('Running in Railway environment, will use environment variables for credentials');
    }
  }

  /**
   * Save credentials for an agent
   * @param {string} agentId - The ID of the agent
   * @param {Object} credentials - The credentials to save
   */
  saveCredentials(agentId, credentials) {
    try {
      // In Railway, we'll save to environment variables in the future
      // For now, just log that we're saving credentials
      if (this.isRailway) {
        console.log(`Would save credentials for agent ${agentId} in Railway environment`);
        // In a real implementation, you might use a database or Railway's persistent storage
        return true;
      }
      
      if (!fs.existsSync(this.credentialsDir)) {
        fs.mkdirSync(this.credentialsDir, { recursive: true });
        console.log('Created credentials directory before saving:', this.credentialsDir);
      }
      
      const filePath = path.join(this.credentialsDir, `${agentId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2));
      console.log(`Saved credentials for agent ${agentId}`);
      return true;
    } catch (error) {
      console.error(`Error saving credentials for agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Load credentials for an agent
   * @param {string} agentId - The ID of the agent
   * @returns {Object|null} The credentials or null if not found
   */
  loadCredentials(agentId) {
    try {
      // In Railway, try to load from environment variables
      if (this.isRailway && agentId.startsWith('gmail')) {
        console.log(`Loading Gmail credentials from environment variables for ${agentId}`);
        
        // Check if we have the necessary environment variables
        if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REDIRECT_URI) {
          const credentials = {
            client_id: process.env.GMAIL_CLIENT_ID,
            client_secret: process.env.GMAIL_CLIENT_SECRET,
            redirect_uri: process.env.GMAIL_REDIRECT_URI
          };
          
          // If we have tokens, add them too
          if (process.env.GMAIL_ACCESS_TOKEN) {
            credentials.access_token = process.env.GMAIL_ACCESS_TOKEN;
          }
          
          if (process.env.GMAIL_REFRESH_TOKEN) {
            credentials.refresh_token = process.env.GMAIL_REFRESH_TOKEN;
          }
          
          if (process.env.GMAIL_EXPIRY_DATE) {
            credentials.expiry_date = parseInt(process.env.GMAIL_EXPIRY_DATE, 10);
          }
          
          return credentials;
        }
        
        console.log('Gmail environment variables not found');
      }
      
      // Fall back to file-based storage
      const filePath = path.join(this.credentialsDir, `${agentId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      console.log(`No credentials file found for agent ${agentId}`);
      return null;
    } catch (error) {
      console.error(`Error loading credentials for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Delete credentials for an agent
   * @param {string} agentId - The ID of the agent
   * @returns {boolean} Whether the deletion was successful
   */
  deleteCredentials(agentId) {
    try {
      // In Railway, we would remove from environment variables in the future
      if (this.isRailway) {
        console.log(`Would delete credentials for agent ${agentId} in Railway environment`);
        return true;
      }
      
      const filePath = path.join(this.credentialsDir, `${agentId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted credentials for agent ${agentId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting credentials for agent ${agentId}:`, error);
      return false;
    }
  }
}

module.exports = new CredentialManager(); 