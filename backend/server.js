const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const agentManager = require('./agents/sharedAgentManager');
const cors = require('cors');
const morgan = require('morgan');

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY environment variable is not set. Some functionality will be limited.');
}

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Create credentials directory if it doesn't exist
const credentialsDir = path.join(__dirname, 'data/credentials');
if (!fs.existsSync(credentialsDir)) {
  try {
    fs.mkdirSync(credentialsDir, { recursive: true });
    console.log('Created credentials directory:', credentialsDir);
  } catch (error) {
    console.error('Error creating credentials directory:', error);
  }
}

// Create agents directory if it doesn't exist
const agentsDir = path.join(__dirname, 'data/agents');
if (!fs.existsSync(agentsDir)) {
  try {
    fs.mkdirSync(agentsDir, { recursive: true });
    console.log('Created agents directory:', agentsDir);
  } catch (error) {
    console.error('Error creating agents directory:', error);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Send list of available agents
  socket.emit('availableAgents', agentManager.getAvailableAgentTypes());
  
  // Send list of active agents
  socket.emit('activeAgents', agentManager.getActiveAgents());
  
  // Handle chat messages
  socket.on('message', async (data) => {
    try {
      const { agentId, message } = data;
      
      // If a specific agent is targeted, use it directly
      if (agentId) {
        const response = await agentManager.processMessage(agentId, message);
        
        // Send response back to client
        socket.emit('message', {
          agentId: agentId,
          message: response,
          timestamp: new Date().toISOString(),
          fromAgent: true
        });
      } else {
        // If no specific agent is targeted, use automatic routing
        const result = await agentManager.processMessageWithRouting(message);
        
        // Send response back to client
        socket.emit('message', {
          agentId: result.agentId,
          message: result.response,
          timestamp: new Date().toISOString(),
          fromAgent: true
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { message: 'Error processing your message' });
    }
  });
  
  // Handle credential upload
  socket.on('uploadCredentials', async (data) => {
    try {
      const { agentType, credentials } = data;
      
      // Create and start the agent
      const agentId = await agentManager.createAgent(agentType, credentials);
      
      // Send updated list of active agents
      socket.emit('activeAgents', agentManager.getActiveAgents());
      socket.emit('message', {
        agentId,
        message: `${agentType} agent is now active and ready to use!`,
        timestamp: new Date().toISOString(),
        fromAgent: true,
        isSystem: true
      });
    } catch (error) {
      console.error('Error uploading credentials:', error);
      socket.emit('error', { message: 'Error setting up agent with provided credentials' });
    }
  });
  
  // Handle agent commands
  socket.on('agentCommand', async (data) => {
    try {
      const { agentId, command } = data;
      
      // Execute the command on the agent
      const result = await agentManager.executeAgentCommand(agentId, command);
      
      // Send result back to client
      socket.emit('commandResult', {
        agentId,
        command,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error executing agent command:', error);
      socket.emit('error', { message: 'Error executing command on agent' });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agents: agentManager.getActiveAgents().length });
});

// Routes
const authRoutes = require('./routes/authRoutes');
const agentRoutes = require('./routes/agentRoutes');
const gmailRoutes = require('./routes/gmailRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/gmail', gmailRoutes);

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start the default agent
  try {
    console.log('Starting default agent...');
    agentManager.createDefaultAgent();
    console.log('Default agent started successfully');
  } catch (error) {
    console.error('Error starting default agent:', error);
    console.log('Server will continue running without the default agent');
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  agentManager.shutdownAllAgents();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 