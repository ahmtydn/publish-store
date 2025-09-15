# Security Policy

## Supported Versions

We actively support the following versions of Publish Store with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

The security of Publish Store is important to us. If you discover a security vulnerability, please follow these guidelines:

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Send an email to security@yourorg.com with:
   - A clear description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact assessment
   - Any suggested fixes (optional)

### What to Include

- **Vulnerability Type**: Authentication, input validation, data exposure, etc.
- **Affected Components**: Which parts of the action are affected
- **Attack Scenarios**: How the vulnerability could be exploited
- **Impact Assessment**: What data or systems could be compromised
- **Proof of Concept**: Code or steps that demonstrate the vulnerability

### Response Timeline

- **Initial Response**: Within 48 hours of receiving your report
- **Assessment**: We'll assess the vulnerability within 7 days
- **Resolution**: Critical vulnerabilities will be patched within 30 days
- **Disclosure**: Coordinated disclosure after patch is available

## Security Best Practices

### For Users

1. **Secure Credential Storage**
   - Always store API keys and certificates in GitHub Secrets
   - Never commit credentials to your repository
   - Use base64 encoding for JSON credentials as shown in our examples

2. **Access Control**
   - Limit workflow permissions to minimum required
   - Use environment protection rules for sensitive deployments
   - Regularly rotate API keys and certificates

3. **Monitoring**
   - Monitor deployment logs for unusual activity
   - Set up alerts for failed deployments
   - Review action outputs for sensitive data exposure

### For Contributors

1. **Secure Development**
   - Follow OWASP secure coding practices
   - Use static analysis tools (ESLint, TypeScript strict mode)
   - Implement comprehensive input validation

2. **Dependency Management**
   - Keep dependencies up to date
   - Use `npm audit` to check for vulnerabilities
   - Pin dependency versions in package-lock.json

3. **Code Review**
   - All code changes require review
   - Security-focused review for authentication and credential handling
   - Test security features with various input scenarios

## Security Features

### Credential Protection

- **Base64 Encoding**: All sensitive inputs require base64 encoding
- **Log Sanitization**: Automatic removal of sensitive data from logs
- **Memory Management**: Secure cleanup of temporary files and variables

### Input Validation

- **Zod Schemas**: Runtime validation of all inputs
- **Format Checking**: Validation of credential formats and structures
- **Injection Prevention**: Sanitization of user inputs

### Network Security

- **HTTPS Only**: All API communications use HTTPS
- **Certificate Validation**: Proper SSL/TLS certificate validation
- **Timeout Handling**: Prevention of hanging connections

### Error Handling

- **Secure Error Messages**: No credential exposure in error messages
- **Context Isolation**: Error contexts don't contain sensitive data
- **Safe Logging**: Sanitized error logging throughout the application

## Known Security Considerations

### Temporary Files

The action creates temporary files during deployment:
- Files are created in secure system temp directories
- Files are automatically cleaned up after use
- File permissions are restricted to the running user

### API Token Lifecycle

- JWT tokens for iOS are short-lived (20 minutes)
- Google Play access tokens are managed by the googleapis library
- No tokens are cached between action runs

### Logging

- All logging goes through our sanitization layer
- Sensitive patterns are automatically redacted
- Debug mode should not be used in production

## Vulnerability Disclosure Policy

We follow responsible disclosure principles:

1. **Private Reporting**: Report vulnerabilities privately first
2. **Coordination**: Work with us to understand and fix the issue
3. **Public Disclosure**: After a fix is released, we'll coordinate public disclosure
4. **Credit**: We'll credit security researchers (with permission)

## Security Updates

- Security patches are released as patch versions (e.g., 1.0.1)
- Critical security updates may be backported to older major versions
- Security advisories are published via GitHub Security Advisories

## Compliance

This action is designed to meet common security requirements:

- **SOC 2**: Logging and audit trail capabilities
- **GDPR**: No personal data processing
- **PCI DSS**: Secure credential handling practices
- **ISO 27001**: Information security management practices

## Contact

For security-related questions or concerns:
- Security Email: security@yourorg.com
- General Issues: Use GitHub Issues for non-security bugs
- Documentation: Check our security documentation

---

**Note**: This security policy is regularly reviewed and updated. The latest version is always available in this repository.