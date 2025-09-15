# Contributing to Publish Store

Thank you for your interest in contributing to Publish Store! This document provides guidelines and information for contributors.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm**: Version 9 or higher
- **TypeScript**: Version 5.5 or higher
- **Git**: Latest version

### Development Setup

1. **Fork the repository**

   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/ahmtydn/publish-store.git
   cd publish-store
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up development environment**

   ```bash
   # Copy environment template
   cp .env.example .env.local

   # Install development tools
   npm run setup:dev
   ```

4. **Verify setup**

   ```bash
   # Run tests to ensure everything works
   npm test

   # Build the project
   npm run build

   # Run linting
   npm run lint
   ```

## 🏗️ Project Structure

```
publish-store/
├── src/                    # Source code
│   ├── core/              # Main action orchestrator
│   ├── deployers/         # Platform-specific deployers
│   ├── services/          # Shared services
│   ├── types/             # TypeScript definitions
│   ├── utils/             # Utility functions
│   └── validators/        # Input validation
├── __tests__/             # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test fixtures
├── docs/                  # Documentation
├── scripts/               # Build and utility scripts
└── dist/                  # Compiled output
```

## 📝 Development Guidelines

### Code Style

We use strict TypeScript with comprehensive linting rules:

- **ESLint**: Airbnb TypeScript configuration
- **Prettier**: Code formatting
- **TypeScript**: Strict mode enabled
- **Husky**: Pre-commit hooks

### Naming Conventions

- **Files**: kebab-case (`my-file.ts`)
- **Classes**: PascalCase (`MyClass`)
- **Functions**: camelCase (`myFunction`)
- **Constants**: UPPER_SNAKE_CASE (`MY_CONSTANT`)
- **Interfaces**: PascalCase with `I` prefix (`IMyInterface`)

### TypeScript Guidelines

```typescript
// ✅ Good: Explicit types
interface DeploymentConfig {
  readonly platform: 'android' | 'ios';
  readonly version: string;
  readonly timeout: number;
}

// ✅ Good: Error handling
class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

// ✅ Good: Dependency injection
class AndroidDeployer {
  constructor(
    private readonly logger: ILogger,
    private readonly httpClient: IHttpClient
  ) {}
}

// ❌ Bad: Any types
function process(data: any): any {
  return data;
}
```

### Architecture Principles

1. **SOLID Principles**
   - Single Responsibility: Each class has one reason to change
   - Open/Closed: Open for extension, closed for modification
   - Liskov Substitution: Subtypes must be substitutable for base types
   - Interface Segregation: Many client-specific interfaces
   - Dependency Inversion: Depend on abstractions, not concretions

2. **Error Handling**
   - Use custom error types with context
   - Provide meaningful error messages
   - Include recovery suggestions when possible
   - Log errors appropriately

3. **Testing**
   - 100% test coverage for new features
   - Unit tests for all public methods
   - Integration tests for workflows
   - Mocking external dependencies

## 🧪 Testing

### Test Structure

```typescript
// Unit test example
describe('AndroidDeployer', () => {
  let deployer: AndroidDeployer;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    deployer = new AndroidDeployer(mockLogger, mockHttpClient);
  });

  describe('deploy', () => {
    it('should deploy successfully with valid inputs', async () => {
      // Arrange
      const inputs = createValidAndroidInputs();
      mockHttpClient.post.mockResolvedValue({ status: 200 });

      // Act
      const result = await deployer.deploy(inputs);

      // Assert
      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('deployment successful')
      );
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- validator.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run tests with debugging
npm run test:debug
```

### Test Coverage Requirements

- **Minimum**: 90% overall coverage
- **Branches**: 85% coverage
- **Functions**: 95% coverage
- **Lines**: 90% coverage

Critical paths (deployment logic) must have 100% coverage.

## 📦 Making Changes

### Branch Naming

- **Features**: `feature/description-of-feature`
- **Bug fixes**: `fix/description-of-fix`
- **Documentation**: `docs/description-of-change`
- **Refactoring**: `refactor/description-of-change`

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

**Examples:**

```
feat(android): add support for AAB uploads

fix(ios): resolve JWT token expiration issue

docs(readme): update installation instructions

test(deployer): add integration tests for retry logic
```

### Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feature/my-awesome-feature
   ```

2. **Make your changes**
   - Write code following our guidelines
   - Add or update tests
   - Update documentation if needed

3. **Test your changes**

   ```bash
   npm run test:all
   npm run lint
   npm run build
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat(scope): description of changes"
   ```

5. **Push to your fork**

   ```bash
   git push origin feature/my-awesome-feature
   ```

6. **Create a Pull Request**
   - Use our PR template
   - Provide clear description
   - Link related issues
   - Request reviews

### Pull Request Template

```markdown
## Description

Brief description of the changes made.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Test coverage maintained/improved

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
- [ ] Related issues linked
```

## 🔧 Development Scripts

```bash
# Development
npm run dev          # Start development mode
npm run build        # Build the project
npm run build:watch  # Build in watch mode

# Testing
npm test             # Run all tests
npm run test:unit    # Run unit tests only
npm run test:int     # Run integration tests
npm run test:coverage # Generate coverage report

# Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking

# Release
npm run release      # Create a new release
npm run changelog    # Generate changelog
```

## 🐛 Debugging

### Debug Configuration

For VSCode, add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Logging

Use the built-in logger for debugging:

```typescript
import { logger } from '../services/logger';

// Debug information
logger.debug('Processing deployment', { platform: 'android' });

// Important information
logger.info('Deployment started', { version: '1.0.0' });

// Warnings
logger.warn('Retrying upload', { attempt: 2 });

// Errors
logger.error('Deployment failed', { error: error.message });
```

## 📚 Documentation

### API Documentation

Update TypeScript documentation for public APIs:

````typescript
/**
 * Deploys an application to the specified platform store.
 *
 * @param inputs - The deployment configuration
 * @returns Promise resolving to deployment result
 * @throws {DeploymentError} When deployment fails
 * @throws {ValidationError} When inputs are invalid
 *
 * @example
 * ```typescript
 * const result = await deployer.deploy({
 *   platform: 'android',
 *   version: '1.0.0',
 *   artifactPath: './app.aab'
 * });
 * ```
 */
async deploy(inputs: ActionInputs): Promise<DeploymentResult> {
  // Implementation
}
````

### README Updates

When adding new features:

1. Update the features list
2. Add usage examples
3. Update input/output tables
4. Add troubleshooting information

## 🔍 Code Review Guidelines

### For Contributors

- Keep PRs focused and small
- Write descriptive commit messages
- Include tests for new functionality
- Update documentation
- Be responsive to feedback

### For Reviewers

- Review for functionality, not style (automated)
- Check test coverage and quality
- Verify documentation updates
- Test the changes locally
- Provide constructive feedback

### Review Checklist

- [ ] Code follows project guidelines
- [ ] Tests are comprehensive and pass
- [ ] Documentation is updated
- [ ] No breaking changes without justification
- [ ] Performance impact considered
- [ ] Security implications reviewed

## 🚀 Release Process

1. **Version Bump**

   ```bash
   npm version patch  # Bug fixes
   npm version minor  # New features
   npm version major  # Breaking changes
   ```

2. **Update Changelog**

   ```bash
   npm run changelog
   ```

3. **Create Release**

   ```bash
   git push origin main --tags
   ```

4. **GitHub Release**
   - Auto-generated from tags
   - Includes changelog
   - Publishes to marketplace

## 🎯 Areas for Contribution

We welcome contributions in these areas:

### High Priority

- **New Platform Support**: Additional app stores
- **Performance Improvements**: Faster uploads and processing
- **Error Recovery**: Better retry mechanisms
- **Documentation**: More examples and guides

### Medium Priority

- **Testing**: Integration tests for edge cases
- **Monitoring**: Better logging and metrics
- **CLI Tool**: Standalone command-line interface
- **Plugins**: Extensibility framework

### Low Priority

- **UI Improvements**: Better GitHub Actions output
- **Analytics**: Deployment statistics
- **Caching**: Artifact caching mechanisms
- **Notifications**: Slack/Teams integration

## 💡 Getting Help

- **Documentation**: Check our [docs](docs/)
- **Issues**: Search existing [GitHub issues](https://github.com/ahmtydn/publish-store/issues)
- **Discussions**: Start a [GitHub discussion](https://github.com/ahmtydn/publish-store/discussions)
- **Discord**: Join our [Discord server](#)

## 📋 Issue Templates

### Bug Report

Use the bug report template for:

- Unexpected behavior
- Errors or crashes
- Performance issues

### Feature Request

Use the feature request template for:

- New functionality
- Enhancements
- Platform support

### Question

Use discussions for:

- Usage questions
- Best practices
- General help

## 🏆 Recognition

Contributors are recognized in:

- **README**: Contributors section
- **Releases**: Release notes
- **Website**: Hall of fame (coming soon)

Thank you for contributing to Publish Store! 🎉
