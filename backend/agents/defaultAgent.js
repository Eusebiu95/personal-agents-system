const { BaseAgent } = require('./baseAgent');
const { OpenAI } = require('openai');
require('dotenv').config();

class DefaultAgent extends BaseAgent {
  constructor() {
    super('default', 'default', 'Default Assistant');
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
    });
    
    // System prompt for the agent
    this.systemPrompt = `You are a helpful assistant that can help with general queries and coordinate with other specialized agents. 
You can help the user manage their tasks, answer questions, and provide information.
If the user asks about specific services like Gmail or Airtable, suggest they connect those services for more specialized help.`;
  }
  
  async start() {
    await super.start();
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not found in environment variables. Using default responses.');
    }
    
    return true;
  }
  
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
    
    let response;
    
    // If OpenAI API key is available, use it to generate a response
    if (process.env.OPENAI_API_KEY) {
      try {
        // Get relevant memory items
        const relevantMemory = this.getRelevantMemory(message, 10);
        
        // Prepare messages for OpenAI
        const messages = [
          { role: 'system', content: this.systemPrompt },
          ...relevantMemory.map(item => ({
            role: item.role,
            content: item.content
          }))
        ];
        
        // Call OpenAI API
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: messages,
          max_tokens: 500,
          temperature: 0.7
        });
        
        response = completion.choices[0].message.content;
      } catch (error) {
        console.error('Error calling OpenAI API:', error);
        response = `I'm sorry, I encountered an error while processing your request. Please try again later.`;
      }
    } else {
      // Fallback response if OpenAI API key is not available
      response = `I'm a default assistant without API access. To use my full capabilities, please set the OPENAI_API_KEY environment variable. For now, I can only echo your message: "${message}"`;
    }
    
    // Add response to memory
    this.addToMemory({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
    
    return response;
  }
  
  async executeCommand(command) {
    if (!this.active) {
      await this.start();
    }
    
    this.lastActivity = new Date();
    
    // Handle specific commands
    switch (command) {
      case 'clear_memory':
        this.memory = [];
        return { success: true, message: 'Memory cleared successfully.' };
      
      case 'get_status':
        return {
          success: true,
          message: 'Default agent status',
          data: {
            active: this.active,
            memorySize: this.memory.length,
            lastActivity: this.lastActivity
          }
        };
      
      default:
        return { success: false, message: `Unknown command: ${command}` };
    }
  }
}

module.exports = { DefaultAgent }; 