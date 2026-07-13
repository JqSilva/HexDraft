export interface LogItem {
  time: string;
  msg: string;
  type: string;
}

export interface ToastState {
  visible: boolean;
  title: string;
  body: string;
  type: string;
}

export interface PublishStatus {
  lastPublishDate: string;
  lastPublishVersion: number;
  lastPublishPatch: string;
  currentPatch: string;
  lastSyncTimestamp: string;
  pendingPublish: boolean;
}
