import { Configuration } from './config';
import { Session } from './session';

interface InitOptions {
  api_key: string;
  tags?: string[];
  inherited_session_id?: string;
}
export class Client {
  private sessions: Session[] = [];
  private current_session_id?: string;
  private config: Configuration;
  constructor() {
    this.config = new Configuration();
  }
  getCurrentSession() {
    return this.sessions.find((s) => s.id === this.current_session_id);
  }

  async init({ api_key, tags, inherited_session_id }: InitOptions) {
    this.config.api_key = api_key;
    const session = new Session();
    session.config = this.config;
    await session.start({
      inherited_session_id,
      tags,
    });
    this.sessions.push(session);
    this.current_session_id = session.id;
  }

  end_session(status: string) {
    const session = this.getCurrentSession();
    if (session) {
      session.end(status);
    }
  }
  log_event(eventType: string, eventData: Record<string, any>) {
    const session = this.getCurrentSession();
    if (session) {
      session.recordEvent(eventType, eventData);
    }
  }
}

export default new Client();
