# Personal Agents System

A system of personal agents for various tasks, including email management via Gmail.

## Features

- **Default Agent**: General purpose assistant for answering questions and providing information.
- **Gmail Agent**: Manages email-related tasks like reading, sending, and searching emails.
- **Automatic Agent Routing**: Automatically routes user queries to the most appropriate agent.

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/Eusebiu95/personal-agents-system.git
   cd personal-agents-system
   ```

2. Install dependencies:
   ```
   cd backend
   npm install
   ```

3. Create a `.env` file in the `backend` directory with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   PORT=3001
   ```

4. Start the server:
   ```
   npm start
   ```

## Usage

- Access the web interface at `http://localhost:3001`
- Use the API endpoints:
  - `POST /api/agents/message` - Send a message to be automatically routed to the appropriate agent
  - `POST /api/agents/:agentId/message` - Send a message to a specific agent
  - `GET /api/agents` - Get a list of all active agents

## Gmail Agent Setup

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Gmail API
3. Create OAuth 2.0 credentials
4. Add the credentials to the Gmail agent through the web interface or API
5. Authenticate with your Google account when prompted

## Deployment

This project is configured for deployment on Railway.

## License

ISC 