const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { BaseAgent } = require('./baseAgent');
const { GmailAgent } = require('./gmailAgent');
const { AirtableAgent } = require('./airtableAgent');
const { DefaultAgent } = require('./defaultAgent');
const credentialManager = require('../credentials/credentialManager');
const { OpenAI } = require('openai');
require('dotenv').config();

class AgentManager {
  constructor() {
    this.agents = {};
    this.credentialManager = credentialManager;
    this.defaultAgent = null;
    
    // Initialize OpenAI client for agent routing
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Create agents directory if it doesn't exist
    this.agentsDir = path.join(__dirname, '../data/agents');
    if (!fs.existsSync(this.agentsDir)) {
      try {
        fs.mkdirSync(this.agentsDir, { recursive: true });
        console.log('Created agents directory in AgentManager:', this.agentsDir);
      } catch (error) {
        console.error('Error creating agents directory in AgentManager:', error);
      }
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
  
  // Get a specific agent by ID
  getAgent(agentId) {
    return this.agents[agentId];
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
  
  // Determine the appropriate agent for a message
  async determineAppropriateAgent(message) {
    try {
      // Get all active agents
      const activeAgents = this.getActiveAgents().filter(agent => agent.status === 'active');
      
      // If there's only the default agent, use it
      if (activeAgents.length <= 1) {
        return 'default';
      }
      
      // Use OpenAI to determine the appropriate agent
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an agent router that determines which specialized agent should handle a user's request.
Available agents:
${activeAgents.map(agent => `- ${agent.type} (${agent.name}): ${this.getAgentDescription(agent.type)}`).join('\n')}

Return ONLY the agent type that should handle the request. If unsure, return "default".`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      });
      
      const agentType = completion.choices[0].message.content.trim().toLowerCase();
      
      // Find an active agent of the determined type
      const matchingAgents = activeAgents.filter(agent => agent.type === agentType);
      
      if (matchingAgents.length > 0) {
        // For Gmail agents, find one that is properly connected
        if (agentType === 'gmail') {
          for (const agent of matchingAgents) {
            const gmailAgent = this.agents[agent.id];
            // Check if the agent has Gmail API initialized
            if (gmailAgent && gmailAgent.gmail) {
              console.log(`Routing message to Gmail agent: ${agent.id} (connected)`);
              return agent.id;
            }
          }
          
          // If no connected Gmail agent found, use the latest one
          const latestGmailAgent = matchingAgents.sort((a, b) => {
            const idA = parseInt(a.id.split('-')[1]);
            const idB = parseInt(b.id.split('-')[1]);
            return idB - idA;
          })[0];
          
          console.log(`No connected Gmail agent found, using latest: ${latestGmailAgent.id}`);
          return latestGmailAgent.id;
        }
        
        console.log(`Routing message to ${agentType} agent: ${matchingAgents[0].id}`);
        return matchingAgents[0].id;
      }
      
      // If no matching agent found, use default
      return 'default';
    } catch (error) {
      console.error('Error determining appropriate agent:', error);
      return 'default';
    }
  }
  
  // Get description for agent type
  getAgentDescription(type) {
    const agentTypes = {
      'gmail': 'Handles email-related tasks like reading, sending, and searching emails',
      'airtable': 'Manages database operations via Airtable',
      'default': 'General purpose assistant for all other tasks'
    };
    
    return agentTypes[type] || 'Unknown agent type';
  }
  
  // Process a message with automatic agent routing
  async processMessageWithRouting(message) {
    try {
      // Determine the appropriate agent
      const agentId = await this.determineAppropriateAgent(message);
      
      // Process the message with the determined agent
      return {
        agentId,
        response: await this.processMessage(agentId, message)
      };
    } catch (error) {
      console.error('Error processing message with routing:', error);
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
      if (!fs.existsSync(this.agentsDir)) {
        console.log('Agents directory does not exist, skipping loading saved agents');
        return;
      }
      
      const files = fs.readdirSync(this.agentsDir);
      console.log(`Found ${files.length} files in agents directory`);
      
      for (const file of files) {
        try {
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
          
          console.log(`Loaded agent: ${agentId} (${stateData.type})`);
        } catch (agentError) {
          console.error(`Error loading agent from file ${file}:`, agentError);
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