# @nvn/ai

A lightweight AI SDK wrapper package that provides pre-configured Amazon Bedrock integration for the BunCN project.

## Features

- **AI SDK Integration**: Re-exports the complete [Vercel AI SDK](https://sdk.vercel.ai/docs) functionality
- **Amazon Bedrock Support**: Pre-configured Bedrock provider with AWS credential chain
- **TypeScript Ready**: Full TypeScript support with proper type definitions

## Installation

```bash
bun add @nvn/ai
```

## Usage

### Basic AI SDK Usage

```typescript
import { generateText } from '@nvn/ai';

const result = await generateText({
  model: 'your-model',
  prompt: 'Hello, world!'
});
```

### Amazon Bedrock Provider

```typescript
import { bedrock, generateText } from '@nvn/ai';

const result = await generateText({
  model: bedrock('anthropic.claude-3-sonnet-20240229-v1:0'),
  prompt: 'Explain quantum computing'
});
```

## Configuration

The Bedrock provider is pre-configured with:
- **Region**: `us-east-1`
- **Credentials**: AWS Node.js credential provider chain (supports environment variables, AWS profiles, IAM roles, etc.)

## Requirements

- AWS credentials configured (via environment variables, AWS CLI, or IAM roles)
- TypeScript 5.x (peer dependency)
