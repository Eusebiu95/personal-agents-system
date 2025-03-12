const express = require('express');
const router = express.Router();
const { AgentManager } = require('../agents/agentManager');
const { authenticateUser } = require('../middleware/auth');

// Initialize agent manager
const agentManager = new AgentManager();

// Middleware to check if Gmail agent exists
const checkGmailAgent = async (req, res, next) => {
  const agentId = req.params.agentId;
  const agent = agentManager.getAgent(agentId);
  
  if (!agent) {
    return res.status(404).json({ success: false, message: 'Gmail agent not found' });
  }
  
  if (agent.type !== 'gmail') {
    return res.status(400).json({ success: false, message: 'Agent is not a Gmail agent' });
  }
  
  req.agent = agent;
  next();
};

// Create a new Gmail agent
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { credentials } = req.body;
    
    if (!credentials || !credentials.client_id || !credentials.client_secret || !credentials.refresh_token) {
      return res.status(400).json({ success: false, message: 'Missing required Gmail credentials' });
    }
    
    // Generate a unique ID for the agent
    const agentId = `gmail-${Date.now()}`;
    
    // Create and start the agent
    const agent = await agentManager.createAgent('gmail', agentId, { credentials });
    
    res.status(201).json({
      success: true,
      message: 'Gmail agent created successfully',
      agent: {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        active: agent.active
      }
    });
  } catch (error) {
    console.error('Error creating Gmail agent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all Gmail agents
router.get('/', authenticateUser, (req, res) => {
  try {
    const gmailAgents = Object.values(agentManager.agents)
      .filter(agent => agent.type === 'gmail')
      .map(agent => ({
        id: agent.id,
        type: agent.type,
        name: agent.name,
        active: agent.active,
        lastActivity: agent.lastActivity
      }));
    
    res.json({
      success: true,
      agents: gmailAgents
    });
  } catch (error) {
    console.error('Error getting Gmail agents:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific Gmail agent
router.get('/:agentId', authenticateUser, checkGmailAgent, (req, res) => {
  try {
    const agent = req.agent;
    
    res.json({
      success: true,
      agent: {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        active: agent.active,
        lastActivity: agent.lastActivity
      }
    });
  } catch (error) {
    console.error('Error getting Gmail agent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a Gmail agent
router.delete('/:agentId', authenticateUser, checkGmailAgent, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    
    // Stop and remove the agent
    await agentManager.removeAgent(agentId);
    
    res.json({
      success: true,
      message: 'Gmail agent deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Gmail agent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send a message to a Gmail agent
router.post('/:agentId/message', authenticateUser, checkGmailAgent, async (req, res) => {
  try {
    const { message } = req.body;
    const agent = req.agent;
    
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    
    // Process the message
    const response = await agent.processMessage(message);
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Execute a command on a Gmail agent
router.post('/:agentId/command', authenticateUser, checkGmailAgent, async (req, res) => {
  try {
    const { command } = req.body;
    const agent = req.agent;
    
    if (!command) {
      return res.status(400).json({ success: false, message: 'Command is required' });
    }
    
    // Execute the command
    const result = await agent.executeCommand(command);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get latest emails
router.get('/:agentId/emails/latest', authenticateUser, checkGmailAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const count = parseInt(req.query.count) || 5;
    
    // Get latest emails
    const emails = await agent.getLatestEmails(count);
    
    res.json({
      success: true,
      emails
    });
  } catch (error) {
    console.error('Error getting latest emails:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search emails
router.get('/:agentId/emails/search', authenticateUser, checkGmailAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const { query } = req.query;
    const count = parseInt(req.query.count) || 5;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }
    
    // Search emails
    const emails = await agent.searchEmails(query, count);
    
    res.json({
      success: true,
      emails
    });
  } catch (error) {
    console.error('Error searching emails:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific email
router.get('/:agentId/emails/:emailId', authenticateUser, checkGmailAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const emailId = req.params.emailId;
    
    // Get the email
    const email = await agent.getEmail(emailId);
    
    res.json({
      success: true,
      email
    });
  } catch (error) {
    console.error('Error getting email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send an email
router.post('/:agentId/emails', authenticateUser, checkGmailAgent, async (req, res) => {
  try {
    const agent = req.agent;
    const { to, subject, body } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, message: 'To, subject, and body are required' });
    }
    
    // Send the email
    const result = await agent.sendEmail(to, subject, body);
    
    res.json({
      success: true,
      message: 'Email sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 