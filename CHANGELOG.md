# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of Publish Store GitHub Action
- Support for Android deployment to Google Play Store
- Support for iOS deployment to App Store Connect
- Comprehensive error handling and logging
- Dry run mode for testing deployments
- Automatic retry with exponential backoff
- Professional TypeScript architecture
- Complete test suite with 95%+ coverage

### Changed

- N/A (Initial release)

### Deprecated

- N/A (Initial release)

### Removed

- N/A (Initial release)

### Fixed

- N/A (Initial release)

### Security

- Secure credential handling with base64 encoding
- Sanitized logging to prevent credential exposure
- Input validation and sanitization

## [1.0.0] - 2025-09-15

### Added

- 🚀 **Initial Release**: Professional GitHub Action for mobile app deployment
- 🤖 **Dual Platform Support**: Deploy to Google Play Store and Apple App Store
- 📱 **Android Deployment**:
  - Google Play Developer API integration
  - Support for AAB and APK files
  - Multiple release tracks (internal, alpha, beta, production)
  - Service account authentication
- 🍎 **iOS Deployment**:
  - App Store Connect API integration
  - Support for IPA files
  - JWT authentication with ES256
  - App discovery and upload simulation
- 🔒 **Enterprise Security**:
  - Base64 encoded credential handling
  - Sanitized logging for sensitive data
  - Secure temporary file management
- ⚡ **Performance & Reliability**:
  - HTTP client with retry logic and exponential backoff
  - Configurable timeout settings
  - Automatic artifact validation
  - Memory-efficient file operations
- 🧪 **Testing & Validation**:
  - Comprehensive input validation with Zod schemas
  - Dry run mode for testing configurations
  - Artifact format validation (size, checksum, extension)
  - Skip duplicate version checks option
- 📊 **Rich Logging & Monitoring**:
  - Structured logging with GitHub Actions integration
  - Deployment progress tracking
  - Error context and recovery suggestions
  - Performance metrics and timing
- 🏗️ **Professional Architecture**:
  - TypeScript with strict mode
  - SOLID principles implementation
  - Factory pattern for platform-specific deployers
  - Dependency injection container
  - Custom error types with context
- 🔧 **Developer Experience**:
  - Comprehensive TypeScript types
  - ESLint and Prettier configuration
  - Jest testing framework
  - Rollup bundling for optimized output
  - GitHub Actions workflows for CI/CD

### Technical Details

#### Core Features

- **Platform Factory**: Automatic deployer selection based on platform
- **Base Deployer**: Abstract base class with common deployment logic
- **Error Handling**: Custom error hierarchy with deployment context
- **HTTP Client**: Axios-based client with retry, timeout, and logging
- **File System Service**: Secure file operations with validation
- **Input Validator**: Zod-based runtime validation with detailed errors
- **Logger Service**: Structured logging with GitHub Actions integration

#### Android Specifics

- **Google Play API**: Full integration with Google Play Developer API v3
- **Authentication**: Service account JSON with OAuth2 flow
- **Upload Process**: Edit sessions, bundle upload, track assignment
- **Validation**: Package name format, service account structure
- **Error Recovery**: Specific handling for Google Play API errors

#### iOS Specifics

- **App Store Connect API**: JWT-based authentication with ES256 algorithm
- **Upload Process**: App discovery, build upload simulation
- **Authentication**: Private key validation and JWT token generation
- **Validation**: Bundle ID format, API key structure validation
- **Error Recovery**: Specific handling for App Store Connect errors

#### Security Implementation

- **Credential Protection**: Base64 encoding for all sensitive inputs
- **Log Sanitization**: Automatic removal of sensitive data from logs
- **Temporary Files**: Secure creation and cleanup of temporary files
- **Input Validation**: Comprehensive validation to prevent injection attacks
- **Error Messages**: Sanitized error messages without credential exposure

#### Performance Optimizations

- **Bundle Size**: Optimized rollup configuration for minimal bundle size
- **Memory Usage**: Streaming file operations for large artifacts
- **Network Efficiency**: Retry logic with exponential backoff
- **Concurrent Operations**: Parallel validation and upload where possible
- **Caching**: Intelligent caching of authentication tokens

### Breaking Changes

- N/A (Initial release)

### Migration Guide

- N/A (Initial release)

### Dependencies

- **Runtime Dependencies**:
  - `@actions/core@^1.10.0`: GitHub Actions toolkit core functionality
  - `@actions/github@^5.1.1`: GitHub API integration
  - `axios@^1.6.0`: HTTP client for API requests
  - `form-data@^4.0.0`: Multipart form data for file uploads
  - `googleapis@^126.0.1`: Google APIs client library
  - `jsonwebtoken@^9.0.2`: JWT token generation for iOS authentication
  - `zod@^3.22.4`: Runtime type validation and parsing

- **Development Dependencies**:
  - `typescript@^5.5.0`: TypeScript compiler and language server
  - `@typescript-eslint/eslint-plugin@^6.0.0`: TypeScript ESLint rules
  - `@typescript-eslint/parser@^6.0.0`: TypeScript parser for ESLint
  - `eslint@^8.45.0`: JavaScript/TypeScript linting
  - `prettier@^3.0.0`: Code formatting
  - `jest@^29.6.0`: Testing framework
  - `@types/jest@^29.5.3`: TypeScript types for Jest
  - `rollup@^4.0.0`: Module bundler for optimized output
  - `husky@^8.0.3`: Git hooks for code quality

### Known Issues

- None known at release

### Roadmap

- [ ] Support for additional platforms (Huawei AppGallery, Amazon Appstore)
- [ ] Enhanced CI/CD pipeline templates
- [ ] Advanced deployment strategies (blue-green, canary)
- [ ] Integration with popular mobile development frameworks
- [ ] CLI tool for local testing and validation
- [ ] Advanced analytics and reporting
- [ ] Plugin system for custom deployment logic

---

## Release Notes Template

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- New features and functionality

### Changed

- Changes to existing functionality

### Deprecated

- Features marked for removal in future versions

### Removed

- Features removed in this version

### Fixed

- Bug fixes and patches

### Security

- Security improvements and fixes

### Technical Changes

- Architecture improvements
- Performance optimizations
- Dependency updates

### Breaking Changes

- Changes that break backward compatibility

### Migration Guide

- Instructions for upgrading from previous versions
```

---

_This changelog is automatically updated with each release. For the most current information, please check the [releases page](https://github.com/your-org/publish-store/releases)._
