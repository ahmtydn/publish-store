/**
 * HTTP Client Service
 * @fileoverview Provides HTTP client with retry logic, timeout handling, and error management
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'node:fs';
import { IHttpClient, RequestConfig, RetryConfig, DEFAULT_RETRY_CONFIG } from '../types/index.js';
import { logger } from './logger.js';

export class HttpClientService implements IHttpClient {
  private readonly client: AxiosInstance;
  private readonly retryConfig: RetryConfig;

  constructor(
    baseURL?: string,
    defaultTimeout: number = 30000,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {
    this.retryConfig = retryConfig;

    const config: AxiosRequestConfig = {
      timeout: defaultTimeout,
      headers: {
        'User-Agent': 'publish-store/1.0.0',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (baseURL) {
      config.baseURL = baseURL;
    }

    this.client = axios.create(config);

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      config => {
        logger.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`, {
          headers: this.sanitizeHeaders(config.headers),
          timeout: config.timeout,
        });
        return config;
      },
      error => {
        logger.error('HTTP Request Error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      response => {
        logger.debug(`HTTP Response: ${response.status} ${response.config.url}`, {
          status: response.status,
          headers: this.sanitizeHeaders(response.headers),
          dataSize: this.getResponseSize(response),
        });
        return response;
      },
      error => {
        if (error.response) {
          logger.error(`HTTP Response Error: ${error.response.status} ${error.config?.url}`, {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          });
        } else if (error.request) {
          logger.error('HTTP Request Failed', {
            url: error.config?.url,
            timeout: error.config?.timeout,
            message: error.message,
          });
        } else {
          logger.error('HTTP Error', { message: error.message });
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.executeWithRetry(() => this.client.get<T>(url, this.buildAxiosConfig(config)));
  }

  async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.executeWithRetry(() =>
      this.client.post<T>(url, data, this.buildAxiosConfig(config))
    );
  }

  async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.executeWithRetry(() =>
      this.client.put<T>(url, data, this.buildAxiosConfig(config))
    );
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.executeWithRetry(() => this.client.delete<T>(url, this.buildAxiosConfig(config)));
  }

  async upload<T>(url: string, filePath: string, config?: RequestConfig): Promise<T> {
    const formData = new FormData();
    formData.append('file', createReadStream(filePath));

    const axiosConfig = this.buildAxiosConfig(config);
    axiosConfig.headers = {
      ...axiosConfig.headers,
      ...formData.getHeaders(),
    };

    return this.executeWithRetry(() => this.client.post<T>(url, formData, axiosConfig));
  }

  async uploadWithFields<T>(
    url: string,
    filePath: string,
    fields: Record<string, string>,
    config?: RequestConfig
  ): Promise<T> {
    const formData = new FormData();

    // Add fields first
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Add file
    formData.append('file', createReadStream(filePath));

    const axiosConfig = this.buildAxiosConfig(config);
    axiosConfig.headers = {
      ...axiosConfig.headers,
      ...formData.getHeaders(),
    };

    return this.executeWithRetry(() => this.client.post<T>(url, formData, axiosConfig));
  }

  private async executeWithRetry<T>(operation: () => Promise<AxiosResponse<T>>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await operation();
        return response.data;
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.retryConfig.maxAttempts || !this.shouldRetry(lastError)) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        logger.warn(
          `HTTP request failed, retrying in ${delay}ms (attempt ${attempt}/${this.retryConfig.maxAttempts})`,
          {
            error: lastError.message,
            attempt,
            delay,
          }
        );

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private shouldRetry(error: Error): boolean {
    return this.retryConfig.shouldRetry(error);
  }

  private calculateDelay(attempt: number): number {
    const delay =
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildAxiosConfig(config?: RequestConfig): AxiosRequestConfig {
    const axiosConfig: AxiosRequestConfig = {};

    if (config?.headers) {
      axiosConfig.headers = config.headers;
    }

    if (config?.timeout) {
      axiosConfig.timeout = config.timeout;
    }

    return axiosConfig;
  }

  private sanitizeHeaders(headers: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!headers) return {};

    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];

    sensitiveHeaders.forEach(header => {
      const key = Object.keys(sanitized).find(k => k.toLowerCase() === header);
      if (key && sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private getResponseSize(response: AxiosResponse): string {
    const contentLength = response.headers['content-length'];
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return 'unknown';
  }

  // Utility method to create authenticated client
  static createWithAuth(authHeader: string, baseURL?: string): HttpClientService {
    const client = new HttpClientService(baseURL);
    client.client.defaults.headers.common['Authorization'] = authHeader;
    return client;
  }

  // Utility method to create client with API key
  static createWithApiKey(
    apiKey: string,
    headerName: string = 'X-API-Key',
    baseURL?: string
  ): HttpClientService {
    const client = new HttpClientService(baseURL);
    client.client.defaults.headers.common[headerName] = apiKey;
    return client;
  }
}
