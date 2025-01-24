import { getISOTime } from '../helpers/time';
import { v4 as uuidv4 } from 'uuid';

// EventType Enum
enum EventType {
  LLM = 'llms',
  ACTION = 'actions',
  API = 'apis',
  TOOL = 'tools',
  ERROR = 'errors',
}

// Base Event Class
class Event {
  event_type: EventType;
  params?: Record<string, any>;
  returns?: string | string[];
  init_timestamp: string;
  end_timestamp?: string;
  agent_id?: string;
  id: string;
  session_id?: string;

  constructor(eventType: EventType, initParams: Partial<Event> = {}) {
    this.event_type = eventType;
    this.params = initParams.params;
    this.returns = initParams.returns;
    this.init_timestamp = initParams.init_timestamp || getISOTime();
    this.end_timestamp = initParams.end_timestamp;
    this.agent_id = initParams.agent_id;
    this.id = initParams.id || uuidv4();
    this.session_id = initParams.session_id;
  }
}

// ActionEvent Class
class ActionEvent extends Event {
  action_type?: string;
  logs?: string | any[];
  screenshot?: string;

  constructor(initParams: Partial<ActionEvent> = {}) {
    super(EventType.ACTION, initParams);
    this.action_type = initParams.action_type;
    this.logs = initParams.logs;
    this.screenshot = initParams.screenshot;
  }
}

// LLMEvent Class
class LLMEvent extends Event {
  thread_id?: string;
  prompt?: string | any[];
  prompt_tokens?: number;
  completion?: string | object;
  completion_tokens?: number;
  cost?: number;
  model?: string;

  constructor(initParams: Partial<LLMEvent> = {}) {
    super(EventType.LLM, initParams);
    this.thread_id = initParams.thread_id;
    this.prompt = initParams.prompt;
    this.prompt_tokens = initParams.prompt_tokens;
    this.completion = initParams.completion;
    this.completion_tokens = initParams.completion_tokens;
    this.cost = initParams.cost;
    this.model = initParams.model;
  }
}

// ToolEvent Class
class ToolEvent extends Event {
  name?: string;
  logs?: string | Record<string, any>;

  constructor(initParams: Partial<ToolEvent> = {}) {
    super(EventType.TOOL, initParams);
    this.name = initParams.name;
    this.logs = initParams.logs;
  }
}

// ErrorEvent Class
class ErrorEvent extends Event {
  trigger_event?: Event;
  exception?: Error;
  error_type?: string;
  code?: string;
  details?: string | Record<string, string>;
  logs?: string;

  constructor(initParams: Partial<ErrorEvent> = {}) {
    super(EventType.ERROR, initParams);
    this.trigger_event = initParams.trigger_event;
    this.exception = initParams.exception;
    this.error_type =
      initParams.error_type ||
      (this.exception ? this.exception.name : undefined);
    this.code = initParams.code;
    this.details =
      initParams.details ||
      (this.exception ? this.exception.message : undefined);
    this.logs =
      initParams.logs || (this.exception ? this.exception.stack : undefined);

    // Ensure end timestamp is set
    if (!this.end_timestamp) {
      this.end_timestamp = getISOTime();
    }

    // Clear exception to prevent serialization issues
    this.exception = undefined;
  }

  get timestamp(): string {
    return this.init_timestamp;
  }
}

export { Event, ActionEvent, LLMEvent, ToolEvent, ErrorEvent };
