# create-beztack

`create-beztack` is a command-line tool to quickly scaffold a new [Beztack](https://github.com/V473r10/beztack) project. Beztack is a modern NX-based monorepo starter with TypeScript, pnpm, and Ultracite.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18.0.0
- [pnpm](https://pnpm.io/) installed on your system
- [PostgreSQL](https://www.postgresql.org/) database

## Usage

To create a new Beztack project, run:

```bash
pnpm create beztack
```

Or, using `npx`:

```bash
npx create-beztack
```

The script will guide you through a few configuration steps:
- **Project name**: The name of your new project (lowercase with hyphens)
- **Project description**: A brief description for your project
- **Initialize Git repository?**: Choose whether to initialize a new Git repository
- **Install dependencies?**: Choose whether to automatically install dependencies using `pnpm install`

## Project Setup

After creating your project, navigate to the project directory and set up your environment:

### 1. Copy `.env.example` to `.env`

```bash
cd my-beztack-app
cp .env.example .env
```

### 2. Configure your environment variables

Open the `.env` file and configure the following variables:

- `BETTER_AUTH_SECRET`: A secret key for Better Auth
  - [Docs](https://www.better-auth.com/docs/installation#set-environment-variables)
- `BETTER_AUTH_URL`: The base URL of your app
- `DATABASE_URL`: The connection string for your PostgreSQL database

### 3. Initialize the database

```bash
pnpm run migrate
```

### 4. Start the development server

```bash
pnpm run dev
```

This will start both the UI (on port 5173) and API servers in development mode.

## Features

Beztack comes with:
- **NX Monorepo**: Efficient build system and caching
- **TypeScript**: Full type safety across the stack
- **Ultracite**: Lightning-fast linting and formatting with Biome
- **Better Auth**: Modern authentication solution
- **PostgreSQL**: Powerful relational database
- **React + Vite**: Fast UI development
- **Nitro**: High-performance API server

## Development

To work on `create-beztack` itself:

```bash
# Install dependencies
pnpm install

# Build the script
pnpm run build

# Run locally
pnpm run start

# Run tests
pnpm run test
```

## License

MIT
