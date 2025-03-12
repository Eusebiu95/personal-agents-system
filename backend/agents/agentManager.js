const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { BaseAgent } = require('./baseAgent');
const { GmailAgent } = require('./gmailAgent');
const { AirtableAgent } = require('./airtableAgent');
const { DefaultAgent } = require('./defaultAgent');
const { CredentialManager } = require('../credentials/credentialManager');

class AgentManager {
  constructor() {
    this.agents = {};
    this.credentialManager = new CredentialManager();
    this.defaultAgent = null;
    
    // Create agents directory if it doesn't exist
    this.agentsDir = path.join(__dirname, '../data/agents');
    if (!fs.existsSync(this.agentsDir)) {
      fs.mkdirSync(this.agentsDir, { recursive: true });
    }
    
    // Load any previously saved agents
    this.loadSavedAgents();
  }
  
  // Get list of available agent types
  getAvailableAgentTypes() {
    return [
      { id: 'gmail', name: 'Gmail', description: 'Email management via Gmail' },
      { id: 'airtable', name: 'Airtable', description: 'Database management via Airtable' },
      { id: 'default', name: 'Default Assistant', description: 'General purpose assistant' }
    ];
  }
  
  // Get list of active agents
  getActiveAgents() {
    return Object.keys(this.agents).map(agentId => ({
      id: agentId,
      name: this.agents[agentId].name,
      type: this.agents[agentId].type,
      status: this.agents[agentId].active ? 'active' : 'inactive'
    }));
  }
  
  // Create the default agent
  createDefaultAgent() {
    const agentId = 'default';
    if (!this.agents[agentId]) {
      this.agents[agentId] = new DefaultAgent();
      this.agents[agentId].start();
      console.log('Default agent created and started');
    }
    return agentId;
  }
  
  // Create a new agent with credentials
  async createAgent(type, id, options = {}) {
    if (this.agents[id]) {
      throw new Error(`Agent with ID ${id} already exists`);
    }

    let agent;

    switch (type) {
      case 'default':
        agent = new DefaultAgent(id);
        this.defaultAgent = agent;
        break;
      case 'gmail':
        agent = new GmailAgent(id, options.credentials);
        break;
      case 'airtable':
        agent = new AirtableAgent(id, options.credentials);
        break;
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }

    try {
      await agent.start();
      this.agents[id] = agent;
      return agent;
    } catch (error) {
      console.error(`Error starting agent ${id}:`, error);
      throw error;
    }
  }
  
  // Process a message with a specific agent
  async processMessage(agentId, message) {
    if (!this.agents[agentId]) {
      if (agentId === 'default') {
        this.createDefaultAgent();
      } else {
        throw new Error(`Agent ${agentId} not found`);
      }
    }
    
    const response = await this.agents[agentId].processMessage(message);
    
    // Save agent state after processing
    this.saveAgentState(agentId);
    
    return response;
  }
  
  // Execute a command on a specific agent
  async executeAgentCommand(agentId, command) {
    if (!this.agents[agentId]) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    const result = await this.agents[agentId].executeCommand(command);
    
    // Save agent state after command execution
    this.saveAgentState(agentId);
    
    return result;
  }
  
  // Save agent state to disk
  saveAgentState(agentId) {
    if (!this.agents[agentId]) return;
    
    const agent = this.agents[agentId];
    const agentState = agent.getState();
    
    const statePath = path.join(this.agentsDir, `${agentId}.json`);
    fs.writeFileSync(statePath, JSON.stringify(agentState, null, 2));
  }
  
  // Load saved agents from disk
  loadSavedAgents() {
    try {
      const files = fs.readdirSync(this.agentsDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const agentId = file.replace('.json', '');
        const statePath = path.join(this.agentsDir, file);
        const stateData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        
        // Create the appropriate agent type
        if (stateData.type === 'gmail') {
          this.agents[agentId] = new GmailAgent(agentId);
        } else if (stateData.type === 'airtable') {
          this.agents[agentId] = new AirtableAgent(agentId);
        } else if (stateData.type === 'default') {
          this.agents[agentId] = new DefaultAgent();
        } else {
          console.warn(`Unknown agent type: ${stateData.type}`);
          continue;
        }
        
        // Load the agent state
        this.agents[agentId].loadState(stateData);
        
        // Start the agent if it was active
        if (stateData.active) {
          this.agents[agentId].start();
        }
      }
      
      console.log(`Loaded ${Object.keys(this.agents).length} saved agents`);
    } catch (error) {
      console.error(`Error loading saved agents: ${error.message}`);
    }
  }
  
  // Shutdown all agents
  async shutdownAllAgents() {
    for (const agentId in this.agents) {
      try {
        await this.agents[agentId].stop();
        this.saveAgentState(agentId);
      } catch (error) {
        console.error(`Error stopping agent ${agentId}: ${error.message}`);
      }
    }
  }
}

module.exports = { AgentManager }; 