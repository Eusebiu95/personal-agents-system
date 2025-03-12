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
  }

  /**
   * Save credentials for an agent
   * @param {string} agentId - The ID of the agent
   * @param {Object} credentials - The credentials to save
   */
  saveCredentials(agentId, credentials) {
    try {
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