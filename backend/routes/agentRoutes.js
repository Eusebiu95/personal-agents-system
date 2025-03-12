const express = require('express');
const router = express.Router();
const agentManager = require('../agents/sharedAgentManager');
const { authenticateUser, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/agents
 * @desc    Get all agents
 * @access  Private
 */
router.get('/', (req, res) => {
  try {
    const activeAgents = agentManager.getActiveAgents();
    res.json({ success: true, agents: activeAgents });
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
router.post('/', authenticateUser, (req, res) => {
  res.json({ message: 'Create agent endpoint (placeholder)' });
});

/**
 * @route   GET /api/agents/:agentId
 * @desc    Get a specific agent
 * @access  Private
 */
router.get('/:agentId', authenticateUser, (req, res) => {
  res.json({ message: `Get agent ${req.params.agentId} endpoint (placeholder)` });
});

/**
 * @route   DELETE /api/agents/:agentId
 * @desc    Delete an agent
 * @access  Private
 */
router.delete('/:agentId', authenticateUser, (req, res) => {
  res.json({ message: `Delete agent ${req.params.agentId} endpoint (placeholder)` });
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
    
    // Process the message
    const response = await agentManager.processMessage(agentId, message);
    
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
    
    // Get the agent
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    // Execute the command
    const result = await agent.executeCommand(command);
    
    // Save agent state after command execution
    agentManager.saveAgentState(agentId);
    
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
  res.json({ message: 'Get agent types endpoint (placeholder)' });
});

/**
 * @route   POST /api/agents/message
 * @desc    Send a message with automatic agent routing
 * @access  Public (temporarily for testing)
 */
router.post('/message', async (req, res) => {
  try {
    const { message } = req.body;
    
    // Check if message is provided
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    
    // Process the message with automatic routing
    const result = await agentManager.processMessageWithRouting(message);
    
    res.json({
      success: true,
      agentId: result.agentId,
      response: result.response
    });
  } catch (error) {
    console.error('Error processing message with routing:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 