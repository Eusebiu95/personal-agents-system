const { AgentManager } = require('./agentManager');

// Create a single instance of the AgentManager to be shared across the application
let sharedAgentManager;

try {
  console.log('Initializing shared AgentManager...');
  sharedAgentManager = new AgentManager();
  console.log('Shared AgentManager initialized successfully');
} catch (error) {
  console.error('Error initializing shared AgentManager:', error);
  
  // Create a minimal fallback AgentManager
  console.log('Creating fallback AgentManager...');
  
  // Define a minimal AgentManager that won't crash the application
  sharedAgentManager = {
    getAvailableAgentTypes: () => [],
    getActiveAgents: () => [],
    getAgent: () => null,
    createDefaultAgent: () => 'default',
    createAgent: async () => null,
    determineAppropriateAgent: async () => 'default',
    processMessageWithRouting: async (message) => ({
      agentId: 'default',
      response: `The agent system is currently unavailable. Please check your configuration. Your message was: "${message}"`
    }),
    processMessage: async (agentId, message) => 
      `The agent system is currently unavailable. Please check your configuration. Your message to agent ${agentId} was: "${message}"`,
    executeAgentCommand: async () => ({ success: false, message: 'Agent system unavailable' }),
    saveAgentState: () => {},
    loadSavedAgents: () => {},
    shutdownAllAgents: async () => {}
  };
}

module.exports = sharedAgentManager; 