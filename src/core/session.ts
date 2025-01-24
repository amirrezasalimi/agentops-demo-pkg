import { trace, type Tracer } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  type SpanExporter,
  type ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { Configuration } from './config';
import chalk from 'chalk';
import logger from '../helpers/logger';
import { v4 as uuidv4 } from 'uuid';
import { Mutex } from 'async-mutex';
import { getISOTime } from '../helpers/time';
import { getHostEnvData } from '../helpers/host-env';

export enum SessionEndState {
  SUCCESS = 'Success',
  FAIL = 'Fail',
  INDETERMINATE = 'Indeterminate',
}

enum SpanExportResult {
  SUCCESS = 0,
  FAILURE = 1,
}

class SessionExporter implements SpanExporter {
  private session: Session;
  private _shutdown = false;
  config: Configuration | null = null;

  constructor(session: Session) {
    this.session = session;
  }

  async export(spans: ReadableSpan[]): Promise<SpanExportResult> {
    if (this._shutdown || !spans.length) return SpanExportResult.SUCCESS;

    try {
      const events = spans.map((span) => ({
        id: span.attributes['event.id'] as string,
        event_type: span.name,
        init_timestamp: span.attributes['event.timestamp'] as number,
        end_timestamp: span.attributes['event.end_timestamp'] as number,
        session_id: this.session.id,
        data: JSON.parse((span.attributes['event.data'] as string) || '{}'),
      }));

      const response = await fetch(
        `${this.config?.endpoint}/v2/create_events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.jwt}`,
          },
          body: JSON.stringify({ events }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      logger.info(`Events exported to AgentOps: ${events.length} events`);
      return SpanExportResult.SUCCESS;
    } catch (error) {
      logger.error('Export failed:', error);
      return SpanExportResult.FAILURE;
    }
  }

  async shutdown(): Promise<void> {
    this._shutdown = true;
  }

  async forceFlush(): Promise<void> {}
}

export class Session {
  config: Configuration | null = null;
  private _lock: Mutex = new Mutex();
  id: string = '';
  tags: string[] = [];
  host_env?: Record<string, string>;
  jwt?: string;
  token_cost: number = 0;
  event_counts: Record<string, number> = {
    llms: 0,
    tools: 0,
    actions: 0,
    errors: 0,
    apis: 0,
  };
  session_url?: string;
  is_running: boolean = false;
  end_state: SessionEndState = SessionEndState.INDETERMINATE;
  end_state_reason?: string;
  end_timestamp: string | null = null;
  init_timestamp: string | null = null;
  private tracerProvider?: BasicTracerProvider;
  private tracer?: Tracer;
  private spanProcessor?: BatchSpanProcessor;

  async start({
    tags,
    inherited_session_id,
  }: {
    tags?: string[];
    inherited_session_id?: string;
  }) {
    this.id = inherited_session_id || uuidv4();
    this.tags = tags || [];
    this.init_timestamp = getISOTime();

    const isRunning = await this._startSession();
    if (!isRunning) {
      logger.error('Failed to start session');
      throw new Error('Failed to start session');
    }

    this.is_running = true;
    this._initializeOpenTelemetry();
  }

  private async _startSession(): Promise<boolean> {
    const release = await this._lock.acquire();

    try {
      const serializedPayload = JSON.stringify({
        session: {
          id: this.id,
          tags: this.tags,
          init_timestamp: this.init_timestamp,
          host_env: await getHostEnvData(),
        },
      });

      const url = `${this.config?.endpoint}/v2/create_session`;
      const headers = {
        'Content-Type': 'application/json',
        'X-Agentops-Api-Key': this.config?.api_key ?? '',
        ...(this.config?.parent_key && {
          'X-Parent-Key': this.config.parent_key,
        }),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: serializedPayload,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseBody = await response.json();
      this.jwt = responseBody.jwt;

      if (!this.jwt) {
        logger.error('JWT not found in response');
        return false;
      }

      logger.info(`Session Replay: ${this.session_url}`);
      return true;
    } catch (error) {
      logger.error('Could not start session', error);
      return false;
    } finally {
      release();
    }
  }

  private _initializeOpenTelemetry(): void {
    this.tracerProvider = new BasicTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'agentops-sdk',
      }),
    });

    const exporter = new SessionExporter(this);
    exporter.config = this.config;
    this.spanProcessor = new BatchSpanProcessor(exporter, {
      scheduledDelayMillis: this.config?.max_wait_time || 5000,
      maxExportBatchSize: this.config?.max_queue_size || 50,
    });

    this.tracerProvider.addSpanProcessor(this.spanProcessor);
    this.tracer = this.tracerProvider.getTracer(`session-${this.id}`);
    trace.setGlobalTracerProvider(this.tracerProvider);
  }

  end(reason: string): void {
    this.is_running = false;
    this.end_state_reason = reason;
    this.end_timestamp = getISOTime();

    this.spanProcessor?.forceFlush().then(() => {
      this.spanProcessor?.shutdown();
      this.tracerProvider?.shutdown();
    });

    this._showColoredAnalysis();
  }

  recordEvent(eventType: string, eventData: Record<string, any>): void {
    if (!this.is_running || !this.tracer) return;

    const span = this.tracer.startSpan(eventType, {
      attributes: {
        'event.id': uuidv4(),
        'event.type': eventType,
        'event.timestamp': Date.now(),
        'event.end_timestamp': Date.now(),
        'event.data': JSON.stringify(eventData),
        'session.id': this.id,
        'session.tags': this.tags.join(','),
      },
    });

    if (this.event_counts[eventType] !== undefined) {
      this.event_counts[eventType]++;
    }

    span.end();
  }

  private _showColoredAnalysis(): void {
    if (!this.end_timestamp || !this.init_timestamp) {
      logger.debug('Session not ended properly, cannot show analysis');
      return;
    }

    const duration =
      (Date.parse(this.end_timestamp) - Date.parse(this.init_timestamp)) / 1000;
    const cost = this.token_cost.toFixed(4);

    const analysis = [
      chalk.bold('\nSession Analysis:'),
      chalk.green(`\n  Duration: ${duration}s`),
      chalk.blue(`  Cost: $${cost}`),
      chalk.magenta(`  LLM Calls: ${this.event_counts.llms}`),
      chalk.cyan(`  Tool Calls: ${this.event_counts.tools}`),
      chalk.yellow(`  Actions: ${this.event_counts.actions}`),
      chalk.red(`  Errors: ${this.event_counts.errors}`),
    ];

    switch (this.end_state) {
      case SessionEndState.SUCCESS:
        analysis.push(chalk.green(`  End State: ${this.end_state}`));
        break;
      case SessionEndState.FAIL:
        analysis.push(chalk.red(`  End State: ${this.end_state}`));
        break;
      default:
        analysis.push(chalk.yellow(`  End State: ${this.end_state}`));
    }

    if (this.end_state_reason) {
      analysis.push(chalk.gray(`  Reason: ${this.end_state_reason}`));
    }

    logger.debug(analysis.join('\n'));
  }
}
