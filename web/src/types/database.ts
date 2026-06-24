export type PipelineStatus = 'NEW' | 'READY' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';

export interface Lead {
  id: string;
  created_at: string;
  place_id?: string;
  name: string;
  phone?: string;
  website?: string;
  city?: string;
  state?: string;
  rating?: number;
  user_ratings_total?: number;
  status_pipeline?: PipelineStatus;
  ai_message?: string;
  copy_gerada?: string; // backwards compatibility
  [key: string]: any; // Allow other properties for now
}
