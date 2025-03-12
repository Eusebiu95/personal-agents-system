const express = require('express');
const router = express.Router();
const agentManager = require('../agents/sharedAgentManager');
const { authenticateUser } = require('../middleware/auth');

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
    
    if (!credentials || !credentials.client_id || !credentials.client_secret) {
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
        id: agentId,
        type: 'gmail',
        name: 'Gmail Assistant',
        active: true
      }
    });
  } catch (error) {
    console.error('Error creating Gmail agent:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Handle OAuth callback
router.get('/auth/callback', async (req, res) => {
  try {
    console.log('OAuth callback received:', req.query);
    const { code, state } = req.query;
    const agentId = state;
    
    if (!code) {
      console.error('OAuth callback error: No authorization code provided');
      return res.status(400).json({ success: false, message: 'Authorization code is required' });
    }
    
    if (!agentId) {
      console.error('OAuth callback error: No agent ID provided');
      return res.status(400).json({ success: false, message: 'Agent ID is required' });
    }
    
    // Get the agent
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      console.error(`OAuth callback error: Agent ${agentId} not found`);
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    console.log(`Processing OAuth code for agent ${agentId}`);
    
    try {
      // Handle the authorization code
      const tokens = await agent.handleAuthCode(code);
      console.log(`Successfully obtained tokens for agent ${agentId}:`, {
        access_token_length: tokens.access_token ? tokens.access_token.length : 0,
        has_refresh_token: !!tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });
      
      // Save the agent state
      agentManager.saveAgentState(agentId);
      console.log(`Agent state saved for ${agentId}`);
      
      // Redirect to the frontend or show a success message
      res.send(`
        <html>
          <head>
            <title>Gmail Authentication Successful</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                text-align: center;
              }
              .success {
                color: green;
                font-size: 24px;
                margin-bottom: 20px;
              }
              .info {
                margin-bottom: 20px;
              }
              .button {
                display: inline-block;
                padding: 10px 20px;
                background-color: #2196f3;
                color: white;
                text-decoration: none;
                border-radius: 5px;
              }
            </style>
          </head>
          <body>
            <h1>Gmail Authentication Successful</h1>
            <p class="success">✓ Your Gmail account has been successfully connected!</p>
            <p class="info">You can now close this window and return to the chat to interact with your Gmail agent.</p>
            <a class="button" href="/">Return to Chat</a>
          </body>
        </html>
      `);
    } catch (error) {
      console.error(`Error handling authorization code for agent ${agentId}:`, error);
      res.status(500).send(`
        <html>
          <head>
            <title>Gmail Authentication Error</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                text-align: center;
              }
              .error {
                color: red;
                font-size: 24px;
                margin-bottom: 20px;
              }
              .info {
                margin-bottom: 20px;
              }
              .details {
                background-color: #f8f8f8;
                padding: 10px;
                border-radius: 5px;
                text-align: left;
                overflow-wrap: break-word;
                margin-bottom: 20px;
              }
              .button {
                display: inline-block;
                padding: 10px 20px;
                background-color: #2196f3;
                color: white;
                text-decoration: none;
                border-radius: 5px;
              }
            </style>
          </head>
          <body>
            <h1>Gmail Authentication Error</h1>
            <p class="error">✗ There was an error connecting your Gmail account</p>
            <p class="info">Please try again or contact support if the issue persists.</p>
            <div class="details">
              <p><strong>Error:</strong> ${error.message}</p>
            </div>
            <a class="button" href="/">Return to Chat</a>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get authentication URL
router.get('/:agentId/auth', authenticateUser, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    
    // Get the agent
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    // Get the authentication URL
    const result = await agent.executeCommand('get_auth_url');
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.message });
    }
    
    res.json({
      success: true,
      authUrl: result.data.authUrl
    });
  } catch (error) {
    console.error('Error getting authentication URL:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all Gmail agents
router.get('/', authenticateUser, (req, res) => {
  res.json({ message: 'Get all Gmail agents endpoint (placeholder)' });
});

// Get a specific Gmail agent
router.get('/:agentId', authenticateUser, checkGmailAgent, (req, res) => {
  res.json({ message: `Get Gmail agent ${req.params.agentId} endpoint (placeholder)` });
});

// Delete a Gmail agent
router.delete('/:agentId', authenticateUser, checkGmailAgent, async (req, res) => {
  res.json({ message: `Delete Gmail agent ${req.params.agentId} endpoint (placeholder)` });
});

// Send a message to a Gmail agent
router.post('/:agentId/message', authenticateUser, checkGmailAgent, async (req, res) => {
  try {
    const { message } = req.body;
    const agentId = req.params.agentId;
    
    // Check if message is provided
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }
    
    // Get the agent
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

// Execute a command on a Gmail agent
router.post('/:agentId/command', authenticateUser, checkGmailAgent, async (req, res) => {
  res.json({ message: `Execute command on Gmail agent ${req.params.agentId} endpoint (placeholder)` });
});

// Get latest emails
router.get('/:agentId/emails/latest', authenticateUser, checkGmailAgent, async (req, res) => {
  res.json({ message: `Get latest emails for Gmail agent ${req.params.agentId} endpoint (placeholder)` });
});

// Search emails
router.get('/:agentId/emails/search', authenticateUser, checkGmailAgent, async (req, res) => {
  res.json({ message: `Search emails for Gmail agent ${req.params.agentId} endpoint (placeholder)` });
});

// Get a specific email
router.get('/:agentId/emails/:emailId', authenticateUser, checkGmailAgent, async (req, res) => {
  res.json({ message: `Get email ${req.params.emailId} for Gmail agent ${req.params.agentId} endpoint (placeholder)` });
});

// Send an email
router.post('/:agentId/emails', authenticateUser, checkGmailAgent, async (req, res) => {
  res.json({ message: `Send email for Gmail agent ${req.params.agentId} endpoint (placeholder)` });
});

// Manually set an authorization code
router.post('/:agentId/set-auth-code', authenticateUser, async (req, res) => {
  try {
    const { code } = req.body;
    const agentId = req.params.agentId;
    
    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code is required' });
    }
    
    // Get the agent
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    // Handle the authorization code
    const tokens = await agent.handleAuthCode(code);
    
    // Save the agent state
    agentManager.saveAgentState(agentId);
    
    res.json({
      success: true,
      message: 'Authorization code processed successfully',
      data: {
        agentId,
        hasAccessToken: true
      }
    });
  } catch (error) {
    console.error('Error setting authorization code:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manually set tokens from JSON
router.post('/:agentId/set-tokens', authenticateUser, async (req, res) => {
  try {
    const { tokens } = req.body;
    const agentId = req.params.agentId;
    
    if (!tokens) {
      return res.status(400).json({ success: false, message: 'Tokens are required' });
    }
    
    // Get the agent
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    
    // Set the tokens
    const result = await agent.setTokensFromJson(tokens);
    
    // Save the agent state
    agentManager.saveAgentState(agentId);
    
    res.json({
      success: true,
      message: 'Tokens set successfully',
      data: result.data
    });
  } catch (error) {
    console.error('Error setting tokens:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 