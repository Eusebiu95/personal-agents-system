const { BaseAgent } = require('./baseAgent');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { OpenAI } = require('openai');
require('dotenv').config();

class GmailAgent extends BaseAgent {
  constructor(id, credentials = null) {
    super(id, 'gmail', 'Gmail Assistant');
    
    this.credentials = credentials;
    this.gmail = null;
    this.auth = null;
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
    });
    
    // System prompt for the agent
    this.systemPrompt = `You are a Gmail assistant that can help with email-related tasks.
You can read emails, send emails, search for emails, and manage labels.
Always be helpful, concise, and respectful of the user's privacy.
When performing actions on emails, always confirm with the user before proceeding.`;
  }
  
  async start() {
    await super.start();
    
    if (!this.credentials) {
      throw new Error('Gmail credentials not provided');
    }
    
    try {
      // Set up authentication
      this.auth = new OAuth2Client(
        this.credentials.client_id,
        this.credentials.client_secret,
        this.credentials.redirect_uri
      );
      
      // Set credentials
      this.auth.setCredentials({
        access_token: this.credentials.access_token,
        refresh_token: this.credentials.refresh_token,
        expiry_date: this.credentials.expiry_date
      });
      
      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      
      // Test the connection
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      console.log(`Connected to Gmail as ${profile.data.emailAddress}`);
      
      return true;
    } catch (error) {
      console.error('Error starting Gmail agent:', error);
      throw error;
    }
  }
  
  async processMessage(message) {
    if (!this.active || !this.gmail) {
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
        
        // Analyze the message to determine the intent
        const intentAnalysis = await this.analyzeIntent(message);
        
        // Handle different intents
        if (intentAnalysis.intent === 'get_latest_emails') {
          const emails = await this.getLatestEmails(intentAnalysis.count || 5);
          response = this.formatEmailList(emails);
        } else if (intentAnalysis.intent === 'search_emails') {
          const emails = await this.searchEmails(intentAnalysis.query, intentAnalysis.count || 5);
          response = this.formatEmailList(emails);
        } else if (intentAnalysis.intent === 'read_email') {
          const email = await this.getEmail(intentAnalysis.id);
          response = this.formatEmail(email);
        } else if (intentAnalysis.intent === 'send_email') {
          // For sending emails, we'll just prepare a response and let the user confirm
          response = `I'll help you send an email. Please confirm the following details:
To: ${intentAnalysis.to}
Subject: ${intentAnalysis.subject}
Body: ${intentAnalysis.body}

To confirm and send this email, please say "Yes, send the email" or provide corrections.`;
        } else {
          // For other intents, use OpenAI to generate a response
          const completion = await this.openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 500,
            temperature: 0.7
          });
          
          response = completion.choices[0].message.content;
        }
      } catch (error) {
        console.error('Error processing message:', error);
        response = `I'm sorry, I encountered an error while processing your request. Please try again later.`;
      }
    } else {
      // Fallback response if OpenAI API key is not available
      response = `I'm a Gmail assistant without API access. To use my full capabilities, please set the OPENAI_API_KEY environment variable.`;
    }
    
    // Add response to memory
    this.addToMemory({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
    
    return response;
  }
  
  async analyzeIntent(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an intent analyzer for a Gmail assistant. 
Analyze the user's message and determine their intent. 
Return a JSON object with the intent and any relevant parameters.
Possible intents: get_latest_emails, search_emails, read_email, send_email, other.
For get_latest_emails, include a count parameter.
For search_emails, include query and count parameters.
For read_email, include an id parameter.
For send_email, include to, subject, and body parameters.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });
      
      const response = completion.choices[0].message.content;
      
      // Parse the JSON response
      try {
        return JSON.parse(response);
      } catch (error) {
        console.error('Error parsing intent analysis:', error);
        return { intent: 'other' };
      }
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return { intent: 'other' };
    }
  }
  
  async getLatestEmails(count = 5) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults: count
      });
      
      const messages = response.data.messages || [];
      const emails = [];
      
      for (const message of messages) {
        const email = await this.getEmail(message.id);
        emails.push(email);
      }
      
      return emails;
    } catch (error) {
      console.error('Error getting latest emails:', error);
      throw error;
    }
  }
  
  async searchEmails(query, count = 5) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: count
      });
      
      const messages = response.data.messages || [];
      const emails = [];
      
      for (const message of messages) {
        const email = await this.getEmail(message.id);
        emails.push(email);
      }
      
      return emails;
    } catch (error) {
      console.error('Error searching emails:', error);
      throw error;
    }
  }
  
  async getEmail(id) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: id,
        format: 'full'
      });
      
      const message = response.data;
      const headers = {};
      
      // Extract headers
      for (const header of message.payload.headers) {
        headers[header.name.toLowerCase()] = header.value;
      }
      
      // Extract body
      let body = '';
      
      if (message.payload.parts) {
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/plain') {
            body = Buffer.from(part.body.data, 'base64').toString('utf8');
            break;
          }
        }
      } else if (message.payload.body.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
      }
      
      return {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        from: headers.from,
        to: headers.to,
        subject: headers.subject,
        date: headers.date,
        body: body
      };
    } catch (error) {
      console.error('Error getting email:', error);
      throw error;
    }
  }
  
  async sendEmail(to, subject, body) {
    try {
      // Create the email
      const email = [
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
        'Content-Transfer-Encoding: 7bit',
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        body
      ].join('\n');
      
      // Encode the email
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      // Send the email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
  
  formatEmailList(emails) {
    if (emails.length === 0) {
      return 'No emails found.';
    }
    
    let result = `Found ${emails.length} emails:\n\n`;
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      result += `${i + 1}. From: ${email.from}\n`;
      result += `   Subject: ${email.subject}\n`;
      result += `   Date: ${email.date}\n`;
      result += `   Snippet: ${email.snippet}\n`;
      result += `   ID: ${email.id}\n\n`;
    }
    
    result += `To read a specific email, say "Read email [ID]" or "Read email ${emails[0].id}".`;
    
    return result;
  }
  
  formatEmail(email) {
    let result = `Email from ${email.from}\n`;
    result += `Subject: ${email.subject}\n`;
    result += `Date: ${email.date}\n\n`;
    result += `${email.body}\n\n`;
    
    return result;
  }
  
  async executeCommand(command) {
    if (!this.active || !this.gmail) {
      await this.start();
    }
    
    this.lastActivity = new Date();
    
    // Handle specific commands
    if (command === 'get_latest_emails') {
      const emails = await this.getLatestEmails(5);
      return {
        success: true,
        message: 'Latest emails retrieved',
        data: emails
      };
    } else if (command === 'clear_memory') {
      this.memory = [];
      return { success: true, message: 'Memory cleared successfully.' };
    } else if (command === 'get_status') {
      return {
        success: true,
        message: 'Gmail agent status',
        data: {
          active: this.active,
          memorySize: this.memory.length,
          lastActivity: this.lastActivity
        }
      };
    } else {
      return { success: false, message: `Unknown command: ${command}` };
    }
  }
}

module.exports = { GmailAgent }; 