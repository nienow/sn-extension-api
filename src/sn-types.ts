export type MessageData = {
  item?: NoteContainer;
  [key: string]: any;
}

export enum ComponentAction {
  StreamContextItem = 'stream-context-item',
  SaveItems = 'save-items',
  ComponentRegistered = 'component-registered',
  ActivateThemes = 'themes',
  ThemesActivated = 'themes-activated',
}

export type Component = {
  uuid?: string
  origin?: string
  data?: ComponentData
  sessionKey?: string
  environment?: string
  platform?: string
  isMobile?: boolean
  acceptsThemes: boolean
  activeThemes: string[]
}

export enum MessagePayloadApi {
  Component = 'component',
}

export type ComponentData = {
  [key: string]: any
}

export type MessagePayload = {
  action: ComponentAction
  data: MessageData
  componentData?: ComponentData
  messageId?: string;
  sessionKey?: string;
  api: MessagePayloadApi
  original?: MessagePayload
  callback?: (...params: any) => void
}

export type SnMediatorOptions = {
  /** Number of milliseconds to wait before saving. Best between 100 and 400ms. **/
  debounceSave?: number;
}

export type NoteContent = {
  text: string;
  title: string;
  editorIdentifier: string;
  appData: Record<string, any>;
  preview_plain: string;
  preview_html: string;
}

export type NoteContainer = {
  content_type: string
  content: NoteContent;
  uuid: string;
  created_at: string;
  updated_at: string;
  isMetadataUpdate: boolean;
}
