const { AgentManager } = require('./agentManager');

// Create a single instance of the AgentManager to be shared across the application
const sharedAgentManager = new AgentManager();

module.exports = sharedAgentManager; 