const { BaseAgent } = require('./baseAgent');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { OpenAI } = require('openai');
const credentialManager = require('../credentials/credentialManager');
require('dotenv').config();

class GmailAgent extends BaseAgent {
  constructor(id, credentials = {}) {
    super(id, 'Gmail Assistant');
    this.type = 'gmail';
    this.credentials = credentials;
    this.oauth2Client = null;
    this.credentialManager = credentialManager;
    this.gmail = null;
    this.auth = null;
    
    // Initialize OpenAI client for natural language processing
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // System prompt for the agent
    this.systemPrompt = `You are a Gmail assistant that can help with email management tasks.
You can help the user read, send, and search emails.
Always be helpful, concise, and respectful of the user's privacy.`;
    
    // Load saved credentials if available
    this.loadCredentials();
  }
  
  async start() {
    await super.start();
    
    try {
      // Try to load credentials from credential manager first
      const savedCredentials = this.credentialManager.loadCredentials(this.id);
      if (savedCredentials) {
        this.credentials = {
          ...this.credentials,
          ...savedCredentials
        };
        console.log(`Loaded saved credentials for Gmail agent ${this.id}`);
      }
      
      // Check if credentials are available
      if (!this.credentials || !this.credentials.client_id || !this.credentials.client_secret) {
        console.warn('Gmail API credentials not found or incomplete. Using limited functionality.');
        return true;
      }
      
      // Set up authentication
      this.auth = new OAuth2Client(
        this.credentials.client_id,
        this.credentials.client_secret,
        this.credentials.redirect_uri || process.env.GMAIL_REDIRECT_URI
      );
      
      // Set credentials if available
      if (this.credentials.access_token) {
        this.auth.setCredentials({
          access_token: this.credentials.access_token,
          refresh_token: this.credentials.refresh_token,
          expiry_date: this.credentials.expiry_date
        });
        
        // Set up token refresh handler
        this.auth.on('tokens', (tokens) => {
          console.log('Token refresh event triggered');
          if (tokens.refresh_token) {
            this.credentials.refresh_token = tokens.refresh_token;
          }
          this.credentials.access_token = tokens.access_token;
          this.credentials.expiry_date = tokens.expiry_date;
          
          // Save updated tokens to credential manager
          this.credentialManager.saveCredentials(this.id, this.credentials);
          console.log(`Updated tokens saved for Gmail agent ${this.id}`);
        });
        
        // Initialize Gmail API
        this.gmail = google.gmail({ version: 'v1', auth: this.auth });
        
        // Test the connection if we have tokens
        try {
          const profile = await this.gmail.users.getProfile({ userId: 'me' });
          console.log(`Connected to Gmail as ${profile.data.emailAddress}`);
        } catch (error) {
          console.error('Error connecting to Gmail API:', error);
          
          // Check if it's an auth error and try to refresh the token
          if (error.code === 401 || (error.response && error.response.status === 401)) {
            try {
              console.log('Attempting to refresh token...');
              
              // Force token refresh
              const { credentials } = await this.auth.refreshAccessToken();
              this.auth.setCredentials(credentials);
              
              // Update and save credentials
              this.credentials.access_token = credentials.access_token;
              if (credentials.refresh_token) {
                this.credentials.refresh_token = credentials.refresh_token;
              }
              this.credentials.expiry_date = credentials.expiry_date;
              this.credentialManager.saveCredentials(this.id, this.credentials);
              
              // Try connection again
              this.gmail = google.gmail({ version: 'v1', auth: this.auth });
              const profile = await this.gmail.users.getProfile({ userId: 'me' });
              console.log(`Connected to Gmail after token refresh as ${profile.data.emailAddress}`);
            } catch (refreshError) {
              console.error('Error refreshing token:', refreshError);
              this.gmail = null;
              
              // If refresh fails, clear tokens to force re-authentication
              if (this.credentials) {
                delete this.credentials.access_token;
                delete this.credentials.refresh_token;
                delete this.credentials.expiry_date;
                this.credentialManager.saveCredentials(this.id, this.credentials);
                console.log(`Cleared invalid tokens for Gmail agent ${this.id}`);
              }
            }
          } else {
            this.gmail = null;
          }
        }
      } else {
        console.log('Gmail API credentials provided but no access token. Authentication required.');
      }
      
      return true;
    } catch (error) {
      console.error('Error starting Gmail agent:', error);
      return true; // Still return true to keep the agent running with limited functionality
    }
  }
  
  // Generate authentication URL
  getAuthUrl() {
    if (!this.auth) {
      throw new Error('Auth client not initialized');
    }
    
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ];
    
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: this.id
    });
  }
  
  // Handle OAuth callback
  async handleAuthCode(code) {
    if (!this.auth) {
      console.error(`Auth client not initialized for agent ${this.id}`);
      throw new Error('Auth client not initialized');
    }
    
    console.log(`Getting tokens for code: ${code.substring(0, 10)}...`);
    
    try {
      const { tokens } = await this.auth.getToken(code);
      console.log('Tokens received:', {
        access_token_length: tokens.access_token ? tokens.access_token.length : 0,
        has_refresh_token: !!tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });
      
      this.auth.setCredentials(tokens);
      console.log('Credentials set in auth client');
      
      // Update credentials
      this.credentials = {
        ...this.credentials,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      };
      
      // Save credentials to credential manager
      this.credentialManager.saveCredentials(this.id, this.credentials);
      console.log(`Saved new credentials for Gmail agent ${this.id}`);
      
      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      console.log('Gmail API initialized');
      
      // Test the connection
      try {
        const profile = await this.gmail.users.getProfile({ userId: 'me' });
        console.log(`Connected to Gmail as ${profile.data.emailAddress}`);
      } catch (error) {
        console.error('Error testing connection after getting tokens:', error);
        // Continue anyway, as we have the tokens
      }
      
      return tokens;
    } catch (error) {
      console.error('Error getting tokens from code:', error);
      throw error;
    }
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
    
    // Check if we have Gmail API access
    if (this.gmail) {
      try {
        // Use OpenAI to determine intent
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are an intent analyzer for a Gmail assistant. 
Analyze the user's message and determine their intent. 
Return a JSON object with the intent and any relevant parameters.
Possible intents: get_latest_emails, search_emails, read_email, send_email, list_labels, get_label_emails, other.
For get_latest_emails, include a count parameter.
For search_emails, include query and count parameters.
For read_email, include an id parameter if provided, otherwise set to null.
For send_email, include to, subject, and body parameters.
For list_labels, no additional parameters are needed.
For get_label_emails, include a label parameter (the label name or ID) and an optional count parameter.`
            },
            {
              role: 'user',
              content: message
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 200,
          temperature: 0.3
        });
        
        const intentAnalysis = JSON.parse(completion.choices[0].message.content);
        
        // Handle different intents
        if (intentAnalysis.intent === 'get_latest_emails') {
          try {
            const count = intentAnalysis.count || 5;
            const response = await this.gmail.users.messages.list({
              userId: 'me',
              maxResults: count
            });
            
            if (!response.data.messages || response.data.messages.length === 0) {
              return "You don't have any emails in your inbox.";
            }
            
            // Get email details
            const emails = [];
            for (const message of response.data.messages.slice(0, 5)) { // Limit to 5 to avoid rate limits
              try {
                const emailData = await this.gmail.users.messages.get({
                  userId: 'me',
                  id: message.id
                });
                
                const headers = {};
                emailData.data.payload.headers.forEach(header => {
                  headers[header.name.toLowerCase()] = header.value;
                });
                
                emails.push({
                  id: message.id,
                  subject: headers.subject || '(No subject)',
                  from: headers.from || '(Unknown sender)',
                  date: headers.date || '(Unknown date)',
                  snippet: emailData.data.snippet
                });
              } catch (error) {
                console.error('Error fetching email details:', error);
              }
            }
            
            // Format response
            let emailListResponse = `Here are your ${emails.length} most recent emails:\n\n`;
            emails.forEach((email, index) => {
              emailListResponse += `${index + 1}. From: ${email.from}\n`;
              emailListResponse += `   Subject: ${email.subject}\n`;
              emailListResponse += `   Date: ${email.date}\n`;
              emailListResponse += `   Preview: ${email.snippet}\n`;
              emailListResponse += `   ID: ${email.id}\n\n`;
            });
            
            return emailListResponse;
          } catch (error) {
            console.error('Error getting latest emails:', error);
            return "I'm sorry, I encountered an error while retrieving your emails. Please try again later.";
          }
        } else if (intentAnalysis.intent === 'search_emails') {
          try {
            const query = intentAnalysis.query || '';
            const count = intentAnalysis.count || 5;
            
            const response = await this.gmail.users.messages.list({
              userId: 'me',
              q: query,
              maxResults: count
            });
            
            if (!response.data.messages || response.data.messages.length === 0) {
              return `No emails found matching "${query}".`;
            }
            
            // Get email details
            const emails = [];
            for (const message of response.data.messages.slice(0, 5)) { // Limit to 5 to avoid rate limits
              try {
                const emailData = await this.gmail.users.messages.get({
                  userId: 'me',
                  id: message.id
                });
                
                const headers = {};
                emailData.data.payload.headers.forEach(header => {
                  headers[header.name.toLowerCase()] = header.value;
                });
                
                emails.push({
                  id: message.id,
                  subject: headers.subject || '(No subject)',
                  from: headers.from || '(Unknown sender)',
                  date: headers.date || '(Unknown date)',
                  snippet: emailData.data.snippet
                });
              } catch (error) {
                console.error('Error fetching email details:', error);
              }
            }
            
            // Format response
            let emailListResponse = `Here are ${emails.length} emails matching "${query}":\n\n`;
            emails.forEach((email, index) => {
              emailListResponse += `${index + 1}. From: ${email.from}\n`;
              emailListResponse += `   Subject: ${email.subject}\n`;
              emailListResponse += `   Date: ${email.date}\n`;
              emailListResponse += `   Preview: ${email.snippet}\n`;
              emailListResponse += `   ID: ${email.id}\n\n`;
            });
            
            return emailListResponse;
          } catch (error) {
            console.error('Error searching emails:', error);
            return "I'm sorry, I encountered an error while searching your emails. Please try again later.";
          }
        } else if (intentAnalysis.intent === 'read_email') {
          try {
            const emailId = intentAnalysis.id;
            
            if (!emailId) {
              return "I need an email ID to read a specific email. You can find email IDs in the list of emails I provide.";
            }
            
            // Get the email details
            const emailData = await this.gmail.users.messages.get({
              userId: 'me',
              id: emailId,
              format: 'full'
            });
            
            if (!emailData || !emailData.data) {
              return `I couldn't find an email with ID ${emailId}.`;
            }
            
            // Extract headers
            const headers = {};
            emailData.data.payload.headers.forEach(header => {
              headers[header.name.toLowerCase()] = header.value;
            });
            
            // Extract body
            let body = '';
            
            // Function to extract text from message parts
            const extractText = (part) => {
              if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
              } else if (part.parts) {
                return part.parts.map(extractText).join('\n');
              }
              return '';
            };
            
            if (emailData.data.payload.body && emailData.data.payload.body.data) {
              body = Buffer.from(emailData.data.payload.body.data, 'base64').toString('utf-8');
            } else if (emailData.data.payload.parts) {
              body = extractText(emailData.data.payload.parts[0]);
            }
            
            // Format response
            let emailResponse = `From: ${headers.from || 'Unknown'}\n`;
            emailResponse += `To: ${headers.to || 'Unknown'}\n`;
            emailResponse += `Subject: ${headers.subject || '(No subject)'}\n`;
            emailResponse += `Date: ${headers.date || 'Unknown'}\n\n`;
            emailResponse += `${body || 'No content available'}`;
            
            return emailResponse;
          } catch (error) {
            console.error('Error reading email:', error);
            return "I'm sorry, I encountered an error while reading the email. Please try again later.";
          }
        } else if (intentAnalysis.intent === 'send_email') {
          try {
            const { to, subject, body } = intentAnalysis;
            
            if (!to) {
              return "I need a recipient email address to send an email.";
            }
            
            if (!subject) {
              return "Please provide a subject for the email.";
            }
            
            if (!body) {
              return "Please provide the content for the email.";
            }
            
            // Create the email
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
              `From: ${process.env.EMAIL_FROM || 'me'}`,
              `To: ${to}`,
              'Content-Type: text/plain; charset=utf-8',
              'MIME-Version: 1.0',
              `Subject: ${utf8Subject}`,
              '',
              body
            ];
            const message = messageParts.join('\n');
            
            // The body needs to be base64url encoded
            const encodedMessage = Buffer.from(message)
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');
            
            // Send the email
            const res = await this.gmail.users.messages.send({
              userId: 'me',
              requestBody: {
                raw: encodedMessage
              }
            });
            
            if (res.status === 200) {
              return `Email sent successfully to ${to}!`;
            } else {
              throw new Error(`Failed to send email: ${res.statusText}`);
            }
          } catch (error) {
            console.error('Error sending email:', error);
            return "I'm sorry, I encountered an error while sending the email. Please try again later.";
          }
        } else if (intentAnalysis.intent === 'list_labels') {
          try {
            // Get all labels
            const response = await this.gmail.users.labels.list({
              userId: 'me'
            });
            
            if (!response.data.labels || response.data.labels.length === 0) {
              return "You don't have any labels in your Gmail account.";
            }
            
            // Format response
            let labelListResponse = "Here are your Gmail labels/folders:\n\n";
            response.data.labels.forEach((label, index) => {
              labelListResponse += `${index + 1}. ${label.name} (${label.type})\n`;
              if (label.messagesTotal !== undefined) {
                labelListResponse += `   Messages: ${label.messagesTotal} (${label.messagesUnread || 0} unread)\n`;
              }
              labelListResponse += `   ID: ${label.id}\n\n`;
            });
            
            return labelListResponse;
          } catch (error) {
            console.error('Error listing labels:', error);
            return "I'm sorry, I encountered an error while retrieving your labels. Please try again later.";
          }
        } else if (intentAnalysis.intent === 'get_label_emails') {
          try {
            const labelName = intentAnalysis.label;
            const count = intentAnalysis.count || 5;
            
            if (!labelName) {
              return "I need a label name or ID to get emails from a specific label.";
            }
            
            // First, get all labels to find the matching one
            const labelsResponse = await this.gmail.users.labels.list({
              userId: 'me'
            });
            
            if (!labelsResponse.data.labels || labelsResponse.data.labels.length === 0) {
              return "You don't have any labels in your Gmail account.";
            }
            
            // Find the label by name or ID
            const label = labelsResponse.data.labels.find(
              l => l.name.toLowerCase() === labelName.toLowerCase() || l.id === labelName
            );
            
            if (!label) {
              return `I couldn't find a label named "${labelName}". Please check the label name and try again.`;
            }
            
            // Get emails from the label
            const response = await this.gmail.users.messages.list({
              userId: 'me',
              labelIds: [label.id],
              maxResults: count
            });
            
            if (!response.data.messages || response.data.messages.length === 0) {
              return `You don't have any emails in the "${label.name}" label.`;
            }
            
            // Get email details
            const emails = [];
            for (const message of response.data.messages.slice(0, 5)) { // Limit to 5 to avoid rate limits
              try {
                const emailData = await this.gmail.users.messages.get({
                  userId: 'me',
                  id: message.id
                });
                
                const headers = {};
                emailData.data.payload.headers.forEach(header => {
                  headers[header.name.toLowerCase()] = header.value;
                });
                
                emails.push({
                  id: message.id,
                  subject: headers.subject || '(No subject)',
                  from: headers.from || '(Unknown sender)',
                  date: headers.date || '(Unknown date)',
                  snippet: emailData.data.snippet
                });
              } catch (error) {
                console.error('Error fetching email details:', error);
              }
            }
            
            // Format response
            let emailListResponse = `Here are ${emails.length} emails from the "${label.name}" label:\n\n`;
            emails.forEach((email, index) => {
              emailListResponse += `${index + 1}. From: ${email.from}\n`;
              emailListResponse += `   Subject: ${email.subject}\n`;
              emailListResponse += `   Date: ${email.date}\n`;
              emailListResponse += `   Preview: ${email.snippet}\n`;
              emailListResponse += `   ID: ${email.id}\n\n`;
            });
            
            return emailListResponse;
          } catch (error) {
            console.error('Error getting emails from label:', error);
            return "I'm sorry, I encountered an error while retrieving emails from the label. Please try again later.";
          }
        } else {
          // For other intents, use OpenAI to generate a response
          const relevantMemory = this.getRelevantMemory(message, 10);
          
          const completion = await this.openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: this.systemPrompt },
              ...relevantMemory.map(item => ({
                role: item.role,
                content: item.content
              }))
            ],
            max_tokens: 500,
            temperature: 0.7
          });
          
          response = completion.choices[0].message.content;
        }
      } catch (error) {
        console.error('Error processing message with Gmail API:', error);
        response = `I'm sorry, I encountered an error while processing your request. Please try again later.`;
      }
    } else {
      // No Gmail API access, provide authentication instructions
      const authUrl = this.getAuthUrl();
      response = `I need access to your Gmail account to help with email tasks. Please authenticate by visiting this URL: ${authUrl}`;
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
          message: 'Gmail agent status',
          data: {
            active: this.active,
            memorySize: this.memory.length,
            lastActivity: this.lastActivity,
            hasCredentials: !!this.credentials?.client_id,
            hasAccessToken: !!this.credentials?.access_token,
            isConnected: !!this.gmail
          }
        };
      
      case 'get_auth_url':
        try {
          const authUrl = this.getAuthUrl();
          return {
            success: true,
            message: 'Authentication URL generated',
            data: { authUrl }
          };
        } catch (error) {
          return {
            success: false,
            message: `Error generating auth URL: ${error.message}`
          };
        }
      
      case 'save_credentials':
        try {
          if (!this.credentials || !this.credentials.client_id) {
            return {
              success: false,
              message: 'No credentials to save'
            };
          }
          
          // Save credentials to credential manager
          this.credentialManager.saveCredentials(this.id, this.credentials);
          
          return {
            success: true,
            message: 'Credentials saved successfully',
            data: {
              agentId: this.id,
              hasAccessToken: !!this.credentials.access_token
            }
          };
        } catch (error) {
          return {
            success: false,
            message: `Error saving credentials: ${error.message}`
          };
        }
      
      case 'set_manual_tokens':
        try {
          return await this.setManualTokens();
        } catch (error) {
          return {
            success: false,
            message: `Error setting manual tokens: ${error.message}`
          };
        }
      
      case 'set_auth_code':
        try {
          if (typeof command === 'object' && command.code) {
            return await this.handleAuthCode(command.code);
          } else {
            return {
              success: false,
              message: 'Authorization code is required as {code: "your_code"}'
            };
          }
        } catch (error) {
          return {
            success: false,
            message: `Error setting auth code: ${error.message}`
          };
        }
      
      case 'set_tokens_json':
        try {
          if (typeof command === 'object' && command.tokens) {
            return await this.setTokensFromJson(command.tokens);
          } else {
            return {
              success: false,
              message: 'Tokens JSON is required as {tokens: "your_tokens_json"}'
            };
          }
        } catch (error) {
          return {
            success: false,
            message: `Error setting tokens from JSON: ${error.message}`
          };
        }
      
      default:
        return { success: false, message: `Unknown command: ${command}` };
    }
  }
  
  // Method to manually set tokens for testing
  async setManualTokens() {
    try {
      // Set some placeholder tokens for testing
      const tokens = {
        access_token: 'ya29.test_access_token',
        refresh_token: '1//test_refresh_token',
        expiry_date: Date.now() + 3600000 // 1 hour from now
      };
      
      // Update credentials
      this.credentials = {
        ...this.credentials,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      };
      
      // Save credentials to credential manager
      this.credentialManager.saveCredentials(this.id, this.credentials);
      
      // Set credentials in auth client
      this.auth.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });
      
      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      
      return {
        success: true,
        message: 'Manual tokens set successfully',
        data: {
          agentId: this.id,
          hasAccessToken: true
        }
      };
    } catch (error) {
      console.error('Error setting manual tokens:', error);
      throw error;
    }
  }
  
  // Method to set tokens from a JSON string
  async setTokensFromJson(tokensJson) {
    try {
      let tokens;
      
      // Parse tokens if they're a string
      if (typeof tokensJson === 'string') {
        tokens = JSON.parse(tokensJson);
      } else {
        tokens = tokensJson;
      }
      
      // Validate tokens
      if (!tokens.access_token) {
        throw new Error('Access token is required');
      }
      
      // Set default expiry if not provided
      if (!tokens.expiry_date) {
        tokens.expiry_date = Date.now() + 3600000; // 1 hour from now
      }
      
      // Update credentials
      this.credentials = {
        ...this.credentials,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || this.credentials.refresh_token,
        expiry_date: tokens.expiry_date
      };
      
      // Save credentials to credential manager
      this.credentialManager.saveCredentials(this.id, this.credentials);
      
      // Initialize auth client if needed
      if (!this.auth) {
        this.auth = new OAuth2Client(
          this.credentials.client_id,
          this.credentials.client_secret,
          this.credentials.redirect_uri || process.env.GMAIL_REDIRECT_URI
        );
      }
      
      // Set credentials in auth client
      this.auth.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || this.credentials.refresh_token,
        expiry_date: tokens.expiry_date
      });
      
      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      
      // Test the connection
      try {
        const profile = await this.gmail.users.getProfile({ userId: 'me' });
        console.log(`Connected to Gmail as ${profile.data.emailAddress}`);
        
        return {
          success: true,
          message: 'Tokens set successfully',
          data: {
            agentId: this.id,
            email: profile.data.emailAddress,
            hasAccessToken: true
          }
        };
      } catch (error) {
        console.error('Error testing connection after setting tokens:', error);
        throw new Error('Invalid tokens: Could not connect to Gmail API');
      }
    } catch (error) {
      console.error('Error setting tokens from JSON:', error);
      throw error;
    }
  }
  
  // Override getState to exclude sensitive credentials
  getState() {
    const state = super.getState();
    
    // Store only non-sensitive credential info in the agent state
    // The sensitive tokens are stored separately by the credential manager
    if (this.credentials) {
      state.credentialInfo = {
        hasCredentials: !!this.credentials.client_id,
        hasAccessToken: !!this.credentials.access_token,
        clientId: this.credentials.client_id,
        redirectUri: this.credentials.redirect_uri
      };
    }
    
    return state;
  }
  
  // Override loadState to handle credentials properly
  loadState(state) {
    super.loadState(state);
    
    // Initialize basic credential info from state
    if (state.credentialInfo) {
      this.credentials = {
        client_id: state.credentialInfo.clientId,
        redirect_uri: state.credentialInfo.redirectUri
      };
      
      // The actual tokens will be loaded from the credential manager in the start() method
    }
  }
}

module.exports = { GmailAgent }; 