# Personal Multi-Agent Chat System

A powerful multi-agent chat system that allows you to interact with various specialized AI agents to help with different tasks.

## Features

- **Default Agent**: A general-purpose assistant that can handle various tasks and coordinate with other agents.
- **Gmail Agent**: An assistant that can help with email-related tasks, such as reading, sending, and searching emails.
- **More agents coming soon!**

## Project Structure

```
personal-agents/
├── backend/
│   ├── agents/
│   │   ├── agentManager.js
│   │   ├── baseAgent.js
│   │   ├── defaultAgent.js
│   │   └── gmailAgent.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── agentRoutes.js
│   │   ├── authRoutes.js
│   │   └── gmailRoutes.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
└── frontend/ (coming soon)
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/personal-agents.git
   cd personal-agents
   ```

2. Install backend dependencies:
   ```
   cd backend
   npm install
   ```

3. Create a `.env` file in the backend directory (copy from `.env.example`):
   ```
   cp .env.example .env
   ```

4. Update the `.env` file with your API keys and secrets.

5. Start the backend server:
   ```
   npm run dev
   ```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/user` - Get current user data

### Agents

- `GET /api/agents` - Get all agents
- `POST /api/agents` - Create a new agent
- `GET /api/agents/:agentId` - Get a specific agent
- `DELETE /api/agents/:agentId` - Delete an agent
- `POST /api/agents/:agentId/message` - Send a message to an agent
- `POST /api/agents/:agentId/command` - Execute a command on an agent
- `GET /api/agents/types` - Get available agent types

### Gmail Agent

- `POST /api/gmail` - Create a new Gmail agent
- `GET /api/gmail` - Get all Gmail agents
- `GET /api/gmail/:agentId` - Get a specific Gmail agent
- `DELETE /api/gmail/:agentId` - Delete a Gmail agent
- `POST /api/gmail/:agentId/message` - Send a message to a Gmail agent
- `POST /api/gmail/:agentId/command` - Execute a command on a Gmail agent
- `GET /api/gmail/:agentId/emails/latest` - Get latest emails
- `GET /api/gmail/:agentId/emails/search` - Search emails
- `GET /api/gmail/:agentId/emails/:emailId` - Get a specific email
- `POST /api/gmail/:agentId/emails` - Send an email

## Authentication

The API uses JWT (JSON Web Token) for authentication. To access protected endpoints, include the JWT token in the request header:

```
x-auth-token: your_jwt_token
```

## Gmail Authentication

To use the Gmail agent, you need to:

1. Create a Google Cloud project and enable the Gmail API
2. Create OAuth 2.0 credentials (client ID and client secret)
3. Set the redirect URI to `http://localhost:3000/api/gmail/auth/callback`
4. Add these credentials to your `.env` file

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 