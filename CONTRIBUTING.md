# Contributing to Q-Chess

Thank you for your interest in contributing to Q-Chess! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- A Supabase account (free tier is sufficient)
- Git for version control
- A code editor (VS Code or recommended)

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nyre.git
   cd nyre
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up Supabase**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy `.env.example` to `.env.local`
   - Add your Supabase URL and anon key to `.env.local`
   - Run the `schema.sql` in your Supabase SQL Editor

5. **Start the development server**:
   ```bash
   npm run dev
   ```

## 🔧 Development Guidelines

### Code Style

- **TypeScript**: All new code should be written in TypeScript
- **ESLint**: Follow the project's ESLint configuration
- **Prettier**: Code formatting is handled by Prettier
- **Tailwind CSS**: Use Tailwind for all styling

### Component Structure

- Place React components in `src/components/`
- Use functional components with hooks
- Follow the existing naming conventions
- Add proper TypeScript interfaces for props

### Database Operations

- All database operations go through `src/lib/chess-service.ts`
- Use Supabase client for all queries
- Follow Row Level Security (RLS) patterns
- Test database changes with the provided schema

### API Routes

- API routes are in `src/app/api/`
- Use proper HTTP status codes
- Include error handling for all endpoints
- Follow RESTful conventions


## 🧪 Testing

### Running Tests
```bash
npm run test        # Run all tests
npm run test:watch  # Run tests in watch mode
npm run lint        # Check code style
npm run typecheck   # TypeScript type checking
```

### Testing Guidelines
- Write unit tests for new functions
- Test API endpoints with different scenarios
- Test chess game logic thoroughly
- Include edge cases in your tests

## 📝 Submitting Changes

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the guidelines above

3. **Test your changes**:
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub

### Commit Message Format

Use conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

### Pull Request Guidelines

- **Clear Description**: Explain what your PR does and why
- **Screenshots**: Include screenshots for UI changes
- **Testing**: Describe how you tested your changes
- **Breaking Changes**: Highlight any breaking changes
- **Related Issues**: Reference any related GitHub issues

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:
- **Clear Title**: Descriptive summary of the issue
- **Steps to Reproduce**: Detailed steps to recreate the bug
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Browser, OS, Node.js version
- **Screenshots**: Visual evidence if applicable

### Feature Requests

For feature requests, provide:
- **Use Case**: Why this feature would be valuable
- **Proposed Solution**: How you envision it working
- **Alternatives**: Other solutions you've considered
- **Additional Context**: Any other relevant information

## 💬 Getting Help

- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Create an issue for bugs or feature requests
- **Code Review**: Request reviews on your pull requests
