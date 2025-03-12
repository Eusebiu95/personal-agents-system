class BaseAgent {
  constructor(id, type, name) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.active = false;
    this.memory = [];
    this.maxMemoryItems = 100;
    this.lastActivity = new Date();
  }
  
  // Start the agent
  async start() {
    this.active = true;
    this.lastActivity = new Date();
    console.log(`Agent ${this.id} (${this.type}) started`);
    return true;
  }
  
  // Stop the agent
  async stop() {
    this.active = false;
    console.log(`Agent ${this.id} (${this.type}) stopped`);
    return true;
  }
  
  // Process a message
  async processMessage(message) {
    if (!this.active) {
      await this.start();
    }
    
    this.lastActivity = new Date();
    
    // Add message to memory
    this.addToMemory({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Default implementation just echoes the message
    const response = `Echo: ${message}`;
    
    // Add response to memory
    this.addToMemory({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
    
    return response;
  }
  
  // Execute a command
  async executeCommand(command) {
    if (!this.active) {
      await this.start();
    }
    
    this.lastActivity = new Date();
    
    // Default implementation just returns the command
    return { success: true, message: `Command received: ${command}` };
  }
  
  // Add an item to memory
  addToMemory(item) {
    this.memory.push(item);
    
    // Trim memory if it exceeds the maximum size
    if (this.memory.length > this.maxMemoryItems) {
      this.memory = this.memory.slice(-this.maxMemoryItems);
    }
  }
  
  // Get relevant memory items
  getRelevantMemory(query, limit = 10) {
    // Simple implementation that returns the most recent items
    // In a real implementation, you might use embeddings and semantic search
    return this.memory.slice(-limit);
  }
  
  // Get the agent's state for persistence
  getState() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      active: this.active,
      memory: this.memory,
      lastActivity: this.lastActivity.toISOString()
    };
  }
  
  // Load the agent's state from persistence
  loadState(state) {
    this.id = state.id;
    this.type = state.type;
    this.name = state.name;
    this.active = state.active;
    this.memory = state.memory || [];
    this.lastActivity = new Date(state.lastActivity);
  }
}

module.exports = { BaseAgent }; 