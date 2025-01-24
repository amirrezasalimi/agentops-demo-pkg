export class Configuration {
  endpoint: string = 'https://api.agentops.ai';
  api_key: string | null = null;
  parent_key: string | null = null;
  max_wait_time: number = 5000;
  max_queue_size: number = 512;
  auto_start_sessions: boolean = true;
}
