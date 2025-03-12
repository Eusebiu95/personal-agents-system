const express = require('express');
const router = express.Router();
const { AgentManager } = require('../agents/agentManager');
const { authenticateUser, isAdmin } = require('../middleware/auth');

// Initialize agent manager
const agentManager = new AgentManager();

/**
 * @route   GET /api/agents
 * @desc    Get all agents
 * @access  Private
 */
router.get('/', authenticateUser, (req, res) => {
  try {
    const agents = Object.values(agentManager.agents).map(agent => ({
      id: agent.id,
      type: agent.type,
      name: agent.name,
      active: agent.active,
      lastActivity: agent.lastActivity
    }));
    
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('Error getting agents:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/agents
 * @desc    Create a new agent
 * @access  Private
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { type, options } = req.body;
    
    if (!type) {
      return res.status(400).json({ success: false, message: 'Agent type is required' });
    }
    
    // Generate a unique ID for the agent
    const agentId = `${type}-${Date.now()}`;
    
    // Create and start the agent
    const agent = await agentManager.createAgent(type, agentId, options);
    
    res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      agent: {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        active: agent.active
      }
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/agents/:agentId
 * @desc    Get a specific agent
 * @access  Private
 */
router.get('/:agentId', authenticateUser, (req, res) => {
  try {
    const agentId = req.params.agentId;
    const agent = agentManager.getAgent(agentId);
    
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
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
    console.error('Error getting agent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/agents/:agentId
 * @desc    Delete an agent
 * @access  Private
 */
router.delete('/:agentId', authenticateUser, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    
    // Check if agent exists
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    // Remove the agent
    await agentManager.removeAgent(agentId);
    
    res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/agents/:agentId/message
 * @desc    Send a message to an agent
 * @access  Private
 */
router.post('/:agentId/message', authenticateUser, async (req, res) => {
  try {
    const { message } = req.body;
    const agentId = req.params.agentId;
    
    // Check if message is provided
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    
    // Check if agent exists
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
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

/**
 * @route   POST /api/agents/:agentId/command
 * @desc    Execute a command on an agent
 * @access  Private
 */
router.post('/:agentId/command', authenticateUser, async (req, res) => {
  try {
    const { command } = req.body;
    const agentId = req.params.agentId;
    
    // Check if command is provided
    if (!command) {
      return res.status(400).json({ success: false, message: 'Command is required' });
    }
    
    // Check if agent exists
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
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

/**
 * @route   GET /api/agents/types
 * @desc    Get available agent types
 * @access  Private
 */
router.get('/types', authenticateUser, (req, res) => {
  try {
    // List of available agent types
    const agentTypes = [
      {
        type: 'default',
        name: 'Default Assistant',
        description: 'General-purpose assistant that can handle various tasks'
      },
      {
        type: 'gmail',
        name: 'Gmail Assistant',
        description: 'Assistant that can help with email-related tasks'
      }
    ];
    
    res.json({
      success: true,
      agentTypes
    });
  } catch (error) {
    console.error('Error getting agent types:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 