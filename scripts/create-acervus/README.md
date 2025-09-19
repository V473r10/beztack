# create-buncn

`create-buncn` is a command-line tool to quickly scaffold a new [Buncn](https://github.com/V473r10/buncn) project. Buncn is a modern Bun-based monorepo starter.

## Prerequisites

- [Bun](https://bun.sh/) installed on your system.
- [PostgreSQL](https://www.postgresql.org/) database.

## Usage

To create a new Buncn project, run:

```bash
bun create buncn
```

Or, using `bunx`

```bash
bunx create-buncn
```

The script will then guide you through a few configuration steps:
- **Project name**: The name of your new project.
- **Project description**: A brief description for your project.
- **Initialize Git repository?**: Choose whether to initialize a new Git repository.
- **Install dependencies?**: Choose whether to automatically install dependencies using `bun install`.

## Project Setup

After creating your project, you can navigate to the project directory but before running `bun run dev` you need to set up your database and environment variables.

### Copy `.env-example` to `.env`

```bash
cp .env-example .env
```

### Configure your environment variables

Open the `.env` file and configure the following variables:

- `BETTER_AUTH_SECRET`: A secret key for Better Auth.
    - [Docs](https://www.better-auth.com/docs/installation#set-environment-variables)
- `BETTER_AUTH_URL`: The base URL of your app.
- `DATABASE_URL`: The connection string for your PostgreSQL database.

### Initialize the database

```bash
bun run migrate
```

### Start the development server

```bash
bun run dev
```
